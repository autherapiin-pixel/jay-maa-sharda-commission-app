"""Emergent Managed Object Storage — invoice photos."""
import os
import uuid
import logging
import requests
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from database import db
from auth import get_current_user, user_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["files"])

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "mandi-khata"
MAX_BYTES = 8 * 1024 * 1024
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    global storage_key
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        storage_key = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def _get(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Photo 8MB se chhoti honi chahiye")
    ext = (os.path.splitext(file.filename or "")[1] or ".jpg").lower()[:6]
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}{ext}"
    try:
        result = await run_in_threadpool(_put, path, data, file.content_type or "image/jpeg")
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        if code == 402:
            raise HTTPException(402, "Storage credits khatam — photo upload nahi ho saki")
        logger.error("upload failed: %s", e)
        raise HTTPException(502, "Upload fail hua")
    await db.files.insert_one({
        "path": result["path"], "owner_id": user["user_id"],
        "name": file.filename, "content_type": file.content_type, "size": len(data),
    })
    return {"path": result["path"], "size": result.get("size", len(data))}


@router.get("/files/{path:path}")
async def get_file(path: str, token: Optional[str] = Query(None),
                   authorization: Optional[str] = Header(None)):
    # Accept bearer header OR ?token= (web <img> cannot send headers)
    rec = await db.files.find_one({"path": path}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    u = await user_from_token(token)
    if not u or u["user_id"] != rec["owner_id"]:
        raise HTTPException(401, "Not authenticated")
    try:
        content, ctype = await run_in_threadpool(_get, path)
    except Exception as e:
        logger.error("download failed: %s", e)
        raise HTTPException(404, "File not found")
    return Response(content=content, media_type=rec.get("content_type") or ctype,
                    headers={"Cache-Control": "private, max-age=86400"})
