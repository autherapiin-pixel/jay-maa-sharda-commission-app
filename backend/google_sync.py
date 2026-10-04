"""Google Drive + Sheets integration.

Single-user model: one shared "default" account stores the Google tokens
(aligns with this app being a single-shop ledger). Each party gets its own
Drive folder; each saved invoice is uploaded as a styled .xlsx inside that
folder AND a row is appended to a master "Invoices" Google Sheet.
"""

import os
import secrets
import logging
import warnings
import asyncio
from datetime import datetime, timezone, timedelta
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload


logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "")

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

MASTER_SHEET_TITLE = "Commission Invoices (All)"

# Allow http in development only (we use https though)
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "0")
# Google frequently adds extra scopes to the response — don't blow up.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

google_router = APIRouter(prefix="/api/oauth/google", tags=["google-oauth"])
sync_router = APIRouter(prefix="/api/google", tags=["google-sync"])


# ---------------- token store ----------------
async def _save_state(db, state: str, user_key: str):
    await db.oauth_states.insert_one({
        "state": state,
        "user_key": user_key,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })


async def _consume_state(db, state: str) -> Optional[str]:
    doc = await db.oauth_states.find_one_and_delete({"state": state})
    if not doc:
        return None
    exp = doc.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and datetime.now(timezone.utc) > exp:
        return None
    return doc.get("user_key")


async def _save_tokens(db, user_key: str, creds: Credentials, email: str = ""):
    await db.google_tokens.update_one(
        {"user_key": user_key},
        {"$set": {
            "user_key": user_key,
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
            "expires_at": creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else None,
            "email": email,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )


async def _load_creds(db, user_key: str) -> Optional[Credentials]:
    doc = await db.google_tokens.find_one({"user_key": user_key})
    if not doc:
        return None
    expires_at = doc.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    creds = Credentials(
        token=doc.get("access_token"),
        refresh_token=doc.get("refresh_token"),
        token_uri=doc.get("token_uri"),
        client_id=doc.get("client_id") or GOOGLE_CLIENT_ID,
        client_secret=doc.get("client_secret") or GOOGLE_CLIENT_SECRET,
        scopes=doc.get("scopes") or SCOPES,
    )
    # Refresh if needed
    needs_refresh = False
    if expires_at and datetime.now(timezone.utc) >= expires_at - timedelta(seconds=30):
        needs_refresh = True
    if not creds.token:
        needs_refresh = True
    if needs_refresh and creds.refresh_token:
        try:
            await asyncio.to_thread(creds.refresh, GoogleRequest())
            await _save_tokens(db, user_key, creds, email=doc.get("email", ""))
        except Exception as e:
            logger.error("Google token refresh failed: %s", e)
            return None
    return creds


def _flow() -> Flow:
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI):
        raise HTTPException(500, "Google OAuth not configured")
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )


# ---------------- OAuth endpoints ----------------
def register_oauth(db, app_api_router):
    """Register OAuth + sync routes against the given main api router."""
    from auth import get_current_user, user_from_token

    @google_router.get("/login")
    async def login(token: Optional[str] = None):
        user = await user_from_token(token)
        if not user:
            return HTMLResponse("<h3>Login expired — app me dobara login karein</h3>", status_code=401)
        flow = _flow()
        state = secrets.token_urlsafe(24)
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            include_granted_scopes="true",
            state=state,
        )
        await _save_state(db, state, user["user_id"])
        return RedirectResponse(auth_url)

    @google_router.get("/callback")
    async def callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
        if error:
            return HTMLResponse(f"<h3>Google auth failed: {error}</h3>", status_code=400)
        if not code or not state:
            return HTMLResponse("<h3>Missing code/state</h3>", status_code=400)
        user_key = await _consume_state(db, state)
        if not user_key:
            return HTMLResponse("<h3>Invalid or expired state</h3>", status_code=400)

        flow = _flow()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            await asyncio.to_thread(flow.fetch_token, code=code)
        creds = flow.credentials

        granted = set(creds.scopes or [])
        required = {
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/spreadsheets",
        }
        if not required.issubset(granted):
            missing = required - granted
            return HTMLResponse(
                f"<h3>Missing required scopes: {', '.join(missing)}</h3>",
                status_code=400,
            )

        # Fetch email for display
        email = ""
        try:
            userinfo = await asyncio.to_thread(
                build("oauth2", "v2", credentials=creds).userinfo().get().execute
            )
            email = userinfo.get("email", "")
        except Exception as e:
            logger.warning("userinfo failed: %s", e)

        await _save_tokens(db, user_key, creds, email=email)
        # Close the browser popup / redirect back to app
        return HTMLResponse(
            """
            <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#FFFBF2">
              <h2 style="color:#D97706">✅ Google connect ho gaya!</h2>
              <p>App me wapas jaayein. Ye tab ab band kar sakte hain.</p>
              <script>setTimeout(()=>{window.close();},1500)</script>
            </body></html>
            """
        )

    @google_router.get("/status")
    async def status(user: dict = Depends(get_current_user)):
        doc = await db.google_tokens.find_one({"user_key": user["user_id"]}, {"_id": 0})
        if not doc:
            return {"connected": False}
        return {
            "connected": True,
            "email": doc.get("email", ""),
            "updated_at": doc.get("updated_at"),
            "master_sheet_id": doc.get("master_sheet_id"),
            "master_sheet_url": doc.get("master_sheet_url"),
        }

    @google_router.post("/disconnect")
    async def disconnect(user: dict = Depends(get_current_user)):
        await db.google_tokens.delete_one({"user_key": user["user_id"]})
        return {"ok": True}

    # mount
    app_api_router.include_router(google_router)
    app_api_router.include_router(sync_router)


# ---------------- Drive / Sheets helpers ----------------
def _drive(creds):
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _sheets(creds):
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


async def ensure_party_folder(db, user_key: str, party: dict, root_folder_id: Optional[str] = None) -> Optional[str]:
    """Create (or reuse) a Drive folder for the party. Returns folder id."""
    creds = await _load_creds(db, user_key)
    if not creds:
        return None

    existing = party.get("drive_folder_id")
    if existing:
        return existing

    def _create():
        drive = _drive(creds)
        meta = {
            "name": party.get("name") or "Party",
            "mimeType": "application/vnd.google-apps.folder",
        }
        if root_folder_id:
            meta["parents"] = [root_folder_id]
        folder = drive.files().create(body=meta, fields="id,webViewLink").execute()
        return folder

    try:
        folder = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error("Drive folder create failed: %s", e)
        return None

    await db.parties.update_one(
        {"id": party["id"]},
        {"$set": {"drive_folder_id": folder["id"], "drive_folder_url": folder.get("webViewLink")}},
    )
    return folder["id"]


_MIME = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}
_FIELDS = {"xlsx": ("drive_file_id", "drive_file_url"), "pdf": ("drive_pdf_id", "drive_pdf_url")}


async def upload_invoice_file(db, user_key: str, invoice: dict, data: bytes, filename: str, kind: str = "xlsx") -> Optional[dict]:
    """Upload the generated xlsx/pdf to the party folder. Returns file metadata."""
    creds = await _load_creds(db, user_key)
    if not creds:
        return None

    party = await db.parties.find_one({"id": invoice["party_id"]})
    if not party:
        return None
    folder_id = await ensure_party_folder(db, user_key, party)
    if not folder_id:
        return None
    id_field, url_field = _FIELDS[kind]

    def _upload():
        drive = _drive(creds)
        existing_file_id = invoice.get(id_field)
        media = MediaIoBaseUpload(BytesIO(data), mimetype=_MIME[kind], resumable=False)
        if existing_file_id:
            try:
                return drive.files().update(
                    fileId=existing_file_id, media_body=media, body={"name": filename},
                    fields="id,webViewLink",
                ).execute()
            except Exception as e:  # file deleted by user → recreate
                logger.warning("drive update failed, recreating: %s", e)
        f = drive.files().create(
            body={"name": filename, "parents": [folder_id]}, media_body=media,
            fields="id,webViewLink",
        ).execute()
        if kind == "pdf":
            # anyone with the link can view → shareable over WhatsApp
            try:
                drive.permissions().create(fileId=f["id"], body={"type": "anyone", "role": "reader"}).execute()
            except Exception as e:
                logger.warning("pdf share permission failed: %s", e)
        return f

    try:
        f = await asyncio.to_thread(_upload)
    except Exception as e:
        logger.error("Drive upload failed: %s", e)
        return None

    await db.invoices.update_one(
        {"id": invoice["id"]},
        {"$set": {id_field: f["id"], url_field: f.get("webViewLink"), "synced_at": datetime.now(timezone.utc)}},
    )
    return f


# ---------------- Ledger (party-wise purchase vs payment out) ----------------
LEDGER_HEADER = ["Date", "Party", "Type", "Purchase (Net)", "Payment Out", "Mode", "Note", "Invoice Date"]
SUMMARY_HEADER = ["Party", "Mobile", "Total Purchase", "Total Payment Out", "Balance (Dena Baaki)", "Invoices"]


async def sync_ledger(db, user_key: str):
    """Rebuild 'Ledger' + 'Party Summary' tabs in the master spreadsheet from the DB (idempotent)."""
    sheet_id = await _get_or_create_master_sheet(db, user_key)
    if not sheet_id:
        return
    creds = await _load_creds(db, user_key)
    if not creds:
        return

    parties = {p["id"]: p for p in await db.parties.find({"user_id": user_key}, {"_id": 0}).to_list(5000)}
    invoices = await db.invoices.find({"user_id": user_key}, {"_id": 0}).to_list(20000)

    ledger = []
    summary = {}
    for inv in invoices:
        pname = inv.get("party_name", "")
        s = summary.setdefault(inv["party_id"], {"name": pname, "purchase": 0.0, "paid": 0.0, "count": 0})
        s["purchase"] += inv.get("net") or 0
        s["count"] += 1
        ledger.append([inv.get("date", ""), pname, "Purchase", inv.get("net") or 0, "", "", "", inv.get("date", "")])
        for p in inv.get("payments") or []:
            s["paid"] += p.get("amount") or 0
            ledger.append([p.get("date", ""), pname, "Payment Out", "", p.get("amount") or 0,
                           p.get("mode", ""), p.get("note", ""), inv.get("date", "")])
    ledger.sort(key=lambda r: (r[0] or "", r[2]))
    summary_rows = [
        [s["name"], (parties.get(pid) or {}).get("phone", ""), round(s["purchase"], 2), round(s["paid"], 2),
         round(s["purchase"] - s["paid"], 2), s["count"]]
        for pid, s in sorted(summary.items(), key=lambda kv: kv[1]["name"])
    ]
    tot_p = round(sum(r[2] for r in summary_rows), 2)
    tot_o = round(sum(r[3] for r in summary_rows), 2)
    summary_rows.append(["TOTAL", "", tot_p, tot_o, round(tot_p - tot_o, 2), sum(r[5] for r in summary_rows)])

    def _write():
        svc = _sheets(creds).spreadsheets()
        meta = svc.get(spreadsheetId=sheet_id).execute()
        titles = {sh["properties"]["title"] for sh in meta.get("sheets", [])}
        reqs = [{"addSheet": {"properties": {"title": t}}} for t in ("Ledger", "Party Summary") if t not in titles]
        if reqs:
            svc.batchUpdate(spreadsheetId=sheet_id, body={"requests": reqs}).execute()
        svc.values().batchClear(spreadsheetId=sheet_id, body={"ranges": ["Ledger!A:H", "Party Summary!A:F"]}).execute()
        svc.values().batchUpdate(spreadsheetId=sheet_id, body={
            "valueInputOption": "USER_ENTERED",
            "data": [
                {"range": "Ledger!A1", "values": [LEDGER_HEADER] + ledger},
                {"range": "Party Summary!A1", "values": [SUMMARY_HEADER] + summary_rows},
            ],
        }).execute()

    try:
        await asyncio.to_thread(_write)
    except Exception as e:
        logger.error("Ledger sync failed: %s", e)


# ---------------- Master Sheet ----------------
MASTER_HEADER = [
    "Invoice ID", "Date", "Party", "Items Total",
    "Bhada", "Mazdoori", "Commission %", "Commission",
    "Kharch Total", "Net", "Payment Out", "Balance", "Items (summary)", "Drive File", "PDF",
]


async def _get_or_create_master_sheet(db, user_key: str) -> Optional[str]:
    doc = await db.google_tokens.find_one({"user_key": user_key})
    if not doc:
        return None
    sheet_id = doc.get("master_sheet_id")
    creds = await _load_creds(db, user_key)
    if not creds:
        return None

    def _verify(sid):
        _sheets(creds).spreadsheets().get(spreadsheetId=sid).execute()
        return True

    if sheet_id:
        try:
            await asyncio.to_thread(_verify, sheet_id)
            return sheet_id
        except Exception:
            sheet_id = None  # recreate

    def _create():
        sh = _sheets(creds).spreadsheets().create(
            body={"properties": {"title": MASTER_SHEET_TITLE}},
            fields="spreadsheetId,spreadsheetUrl",
        ).execute()
        # header row
        _sheets(creds).spreadsheets().values().update(
            spreadsheetId=sh["spreadsheetId"],
            range="A1",
            valueInputOption="RAW",
            body={"values": [MASTER_HEADER]},
        ).execute()
        return sh

    try:
        sh = await asyncio.to_thread(_create)
    except Exception as e:
        logger.error("Master sheet create failed: %s", e)
        return None

    await db.google_tokens.update_one(
        {"user_key": user_key},
        {"$set": {
            "master_sheet_id": sh["spreadsheetId"],
            "master_sheet_url": sh["spreadsheetUrl"],
        }},
    )
    return sh["spreadsheetId"]


async def upsert_master_sheet_row(db, user_key: str, invoice: dict):
    sheet_id = await _get_or_create_master_sheet(db, user_key)
    if not sheet_id:
        return
    creds = await _load_creds(db, user_key)
    if not creds:
        return

    items_summary = ", ".join(
        f"{(i.get('item') or '').strip()}({i.get('qty') or 0}×{i.get('rate') or 0})"
        for i in (invoice.get("items") or [])
        if (i.get('item') or '').strip()
    )
    row = [
        invoice.get("id", ""),
        invoice.get("date", ""),
        invoice.get("party_name", ""),
        invoice.get("items_total", 0),
        invoice.get("bhada", 0),
        invoice.get("mazdoori", 0),
        invoice.get("commission_percent", 0),
        invoice.get("commission", 0),
        invoice.get("kharch_total", 0),
        invoice.get("net", 0),
        invoice.get("paid_amount", 0),
        invoice.get("balance", 0),
        items_summary,
        invoice.get("drive_file_url", ""),
        invoice.get("drive_pdf_url", ""),
    ]

    def _upsert():
        svc = _sheets(creds).spreadsheets().values()
        # Find existing row by invoice id in column A
        res = svc.get(spreadsheetId=sheet_id, range="A:A").execute()
        values = res.get("values", [])
        found_row = None
        for idx, r in enumerate(values[1:], start=2):  # skip header
            if r and r[0] == invoice["id"]:
                found_row = idx
                break
        if found_row:
            svc.update(
                spreadsheetId=sheet_id,
                range=f"A{found_row}:O{found_row}",
                valueInputOption="USER_ENTERED",
                body={"values": [row]},
            ).execute()
        else:
            svc.append(
                spreadsheetId=sheet_id,
                range="A:O",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [row]},
            ).execute()

    try:
        await asyncio.to_thread(_upsert)
    except Exception as e:
        logger.error("Master sheet upsert failed: %s", e)


async def remove_master_sheet_row(db, user_key: str, invoice_id: str):
    doc = await db.google_tokens.find_one({"user_key": user_key})
    if not doc or not doc.get("master_sheet_id"):
        return
    sheet_id = doc["master_sheet_id"]
    creds = await _load_creds(db, user_key)
    if not creds:
        return

    def _delete():
        svc = _sheets(creds).spreadsheets()
        res = svc.values().get(spreadsheetId=sheet_id, range="A:A").execute()
        values = res.get("values", [])
        found_row = None
        for idx, r in enumerate(values[1:], start=2):
            if r and r[0] == invoice_id:
                found_row = idx
                break
        if not found_row:
            return
        # Get sheetId (first sheet)
        meta = svc.get(spreadsheetId=sheet_id).execute()
        first_sheet_id = meta["sheets"][0]["properties"]["sheetId"]
        svc.batchUpdate(
            spreadsheetId=sheet_id,
            body={"requests": [{
                "deleteDimension": {
                    "range": {
                        "sheetId": first_sheet_id,
                        "dimension": "ROWS",
                        "startIndex": found_row - 1,
                        "endIndex": found_row,
                    }
                }
            }]},
        ).execute()

    try:
        await asyncio.to_thread(_delete)
    except Exception as e:
        logger.error("Master sheet delete failed: %s", e)


async def delete_drive_file(db, user_key: str, file_id: str):
    creds = await _load_creds(db, user_key)
    if not creds:
        return
    try:
        await asyncio.to_thread(_drive(creds).files().delete(fileId=file_id).execute)
    except Exception as e:
        logger.error("Drive delete failed: %s", e)


async def is_connected(db, user_key: str) -> bool:
    doc = await db.google_tokens.find_one({"user_key": user_key})
    return bool(doc)
