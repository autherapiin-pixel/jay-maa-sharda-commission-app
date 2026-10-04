"""Authentication: Emergent Google session exchange + email/mobile + password login.

Both flows mint an opaque `session_token` stored in `user_sessions`, so every
protected route uses the same `get_current_user` dependency.
"""
import os
import re
import uuid
import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Optional

import bcrypt
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from database import db
from emailer import send_email, EMAIL_FROM_NAME

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_DAYS = 30

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------- models ----------------
class SessionIn(BaseModel):
    session_id: str


class RegisterIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)  # email or mobile
    password: str = Field(min_length=6, max_length=72)
    name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = None  # optional recovery email for mobile signups


class LoginIn(BaseModel):
    identifier: str
    password: str = Field(min_length=1, max_length=72)


class ForgotIn(BaseModel):
    identifier: str


class ResetIn(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=6, max_length=72)


# ---------------- helpers ----------------
def normalize_identifier(v: str) -> tuple[str, str]:
    v = (v or "").strip()
    if EMAIL_RE.fullmatch(v):
        return "email", v.casefold()
    digits = re.sub(r"\D", "", v)
    if len(digits) == 10:
        return "phone", "+91" + digits
    if 10 < len(digits) <= 15:
        return "phone", "+" + digits
    raise HTTPException(422, "सही email ya mobile number daalein")


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _hash_password(pw: str) -> str:
    return (await run_in_threadpool(bcrypt.hashpw, pw.encode(), bcrypt.gensalt(rounds=12))).decode()


async def _check_password(pw: str, stored: Optional[str]) -> bool:
    if not stored:
        # burn similar time for unknown users
        await run_in_threadpool(bcrypt.hashpw, b"x", bcrypt.gensalt(rounds=12))
        return False
    try:
        return await run_in_threadpool(bcrypt.checkpw, pw.encode(), stored.encode())
    except ValueError:
        return False


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u.get("email"),
        "phone": u.get("phone"),
        "name": u.get("name") or "",
        "picture": u.get("picture"),
        "auth_provider": u.get("auth_provider", "custom"),
    }


async def _claim_legacy_data(user_id: str):
    """First account ever created inherits the pre-auth single-shop data."""
    if await db.users.count_documents({}) != 1:
        return
    for coll in (db.parties, db.invoices, db.settings, db.google_tokens):
        await coll.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": user_id}})
    await db.google_tokens.update_many({"user_key": "default"}, {"$set": {"user_key": user_id}})


async def _mint_session(user_id: str, token: Optional[str] = None, days: int = SESSION_DAYS) -> str:
    token = token or secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=days),
    })
    return token


async def _create_user(**fields) -> dict:
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "created_at": datetime.now(timezone.utc),
        **{k: v for k, v in fields.items() if v is not None},
    }
    await db.users.insert_one(user)
    await _claim_legacy_data(user["user_id"])
    await _notify_admin_new_user(user)
    return user


async def _notify_admin_new_user(user: dict):
    if not ADMIN_EMAIL:
        return
    try:
        who = escape(user.get("email") or user.get("phone") or "")
        html = (
            f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
            f'<p>Naya user {EMAIL_FROM_NAME} par register hua:</p>'
            f'<p><strong>{escape(user.get("name") or "-")}</strong><br>{who}</p>'
            f'<p style="font-size:12px;color:#888">Sent by {escape(EMAIL_FROM_NAME)}.</p></td></tr></table>'
        )
        await send_email(to=ADMIN_EMAIL, subject=f"{EMAIL_FROM_NAME}: naya user register hua", html=html)
    except Exception as e:
        logger.warning("admin notify failed: %s", e)


async def user_from_token(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    exp = sess.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    user = await user_from_token(token)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def get_current_user_any(token: Optional[str] = Query(None),
                               authorization: Optional[str] = Header(None)) -> dict:
    """Bearer header OR ?token= — for links opened in a browser (exports, PDFs)."""
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    user = await user_from_token(token)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def ensure_indexes():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)


# ---------------- routes ----------------
@router.post("/session")
async def exchange_session(body: SessionIn):
    """Exchange the one-time Emergent `session_id` for our session token."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    except Exception:
        raise HTTPException(401, "Google login failed")
    if resp.status_code != 200:
        raise HTTPException(401, "Invalid or expired session")
    data = resp.json()
    email = (data.get("email") or "").casefold()
    if not email:
        raise HTTPException(401, "No email from Google")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        patch = {"name": data.get("name") or user.get("name"), "picture": data.get("picture")}
        if not user.get("password_hash"):
            patch["auth_provider"] = "google"
        elif user.get("auth_provider") != "both":
            patch["auth_provider"] = "both"
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": patch})
        user.update(patch)
    else:
        user = await _create_user(email=email, name=data.get("name"), picture=data.get("picture"),
                                  auth_provider="google")
    token = await _mint_session(user["user_id"], token=data.get("session_token"), days=7)
    return {"session_token": token, "user": public_user(user)}


@router.post("/register")
async def register(body: RegisterIn):
    field, value = normalize_identifier(body.identifier)
    if await db.users.find_one({field: value}, {"_id": 1}):
        raise HTTPException(409, "Ye account pehle se hai — login karein")
    fields = {field: value, "name": body.name, "auth_provider": "custom",
              "password_hash": await _hash_password(body.password)}
    if field == "phone" and body.email:
        rec_field, rec_val = normalize_identifier(body.email)
        if rec_field != "email":
            raise HTTPException(422, "Recovery email sahi nahi hai")
        if await db.users.find_one({"email": rec_val}, {"_id": 1}):
            raise HTTPException(409, "Ye email pehle se registered hai")
        fields["email"] = rec_val
    user = await _create_user(**fields)
    token = await _mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@router.post("/login")
async def login(body: LoginIn):
    field, value = normalize_identifier(body.identifier)
    user = await db.users.find_one({field: value}, {"_id": 0})
    if not await _check_password(body.password, user.get("password_hash") if user else None):
        if user and not user.get("password_hash"):
            raise HTTPException(401, "Is account par password set nahi hai — Google se login karein ya 'Password bhool gaye' use karein")
        raise HTTPException(401, "Galat email/mobile ya password")
    token = await _mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    field, value = normalize_identifier(body.identifier)
    user = await db.users.find_one({field: value}, {"_id": 0})
    generic = {"message": "Agar account hai to reset link email par bhej di gayi hai."}
    if not user:
        return generic
    if not user.get("email"):
        raise HTTPException(400, "Is mobile account par koi email nahi hai — reset link ke liye email zaroori hai")
    raw = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
        "reset_token_hash": _hash_token(raw),
        "reset_token_expires_at": now + timedelta(minutes=30),
    }})
    link = f"{PUBLIC_BASE_URL}/reset-password?token={raw}"
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<h2 style="color:#D97706;margin:0 0 12px">{escape(EMAIL_FROM_NAME)}</h2>'
        f'<p>Namaste {escape(user.get("name") or "")},</p>'
        f'<p>Aapke account ka password reset karne ke liye neeche button dabayein. '
        f'Ye link 30 minute tak valid hai.</p>'
        f'<p><a href="{link}" style="display:inline-block;padding:12px 20px;background:#D97706;color:#fff;'
        f'text-decoration:none;border-radius:8px;font-weight:bold">Naya password banayein</a></p>'
        f'<p style="font-size:12px;color:#888">Agar aapne ye request nahi ki, to is email ko ignore karein. '
        f'Sent by {escape(EMAIL_FROM_NAME)}. Hum kabhi aapka password email se nahi maangte.</p>'
        f'</td></tr></table>'
    )
    await send_email(to=user["email"], subject=f"{EMAIL_FROM_NAME}: password reset link", html=html)
    return {**generic, "email_hint": _mask_email(user["email"])}


def _mask_email(e: str) -> str:
    name, _, domain = e.partition("@")
    return (name[:2] + "***@" + domain) if domain else e


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    now = datetime.now(timezone.utc)
    h = _hash_token(body.token)
    user = await db.users.find_one({"reset_token_hash": h, "reset_token_expires_at": {"$gt": now}}, {"_id": 0})
    if not user:
        raise HTTPException(400, "Link galat ya expire ho gaya hai — dobara request karein")
    new_hash = await _hash_password(body.new_password)
    res = await db.users.update_one(
        {"user_id": user["user_id"], "reset_token_hash": h, "reset_token_expires_at": {"$gt": now}},
        {"$set": {"password_hash": new_hash, "password_changed_at": now,
                  "auth_provider": "both" if user.get("auth_provider") == "google" else user.get("auth_provider", "custom")},
         "$unset": {"reset_token_hash": "", "reset_token_expires_at": ""}},
    )
    if res.modified_count != 1:
        raise HTTPException(400, "Link galat ya expire ho gaya hai")
    # log out every device
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    token = await _mint_session(user["user_id"])
    return {"message": "Password badal gaya", "session_token": token, "user": public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        await db.user_sessions.delete_one({"session_token": authorization.split(" ", 1)[1].strip()})
    return {"ok": True}
