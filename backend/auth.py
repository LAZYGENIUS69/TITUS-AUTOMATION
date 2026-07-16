"""Small self-contained authentication service for the certificate app."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from sqlalchemy.orm import Session

import models

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
AUTH_SECRET = os.getenv("AUTH_SECRET", "local-development-secret-change-me").encode("utf-8")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt_b64, digest_b64 = stored_hash.split("$", 2)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(digest_b64.encode())
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _encode(data: dict) -> str:
    raw = base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":")).encode()).rstrip(b"=")
    signature = hmac.new(AUTH_SECRET, raw, hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return f"{raw.decode()}.{sig.decode()}"


def _decode(token: str) -> Optional[dict]:
    try:
        raw_b64, sig_b64 = token.split(".", 1)
        raw = raw_b64.encode()
        provided = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
        expected = hmac.new(AUTH_SECRET, raw, hashlib.sha256).digest()
        if not hmac.compare_digest(provided, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(raw + b"=" * (-len(raw) % 4)))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


def create_access_token(user: models.User) -> str:
    now = int(time.time())
    return _encode({"sub": user.id, "email": user.email, "role": user.role, "iat": now, "exp": now + TOKEN_TTL_SECONDS})


def get_user_from_token(db: Session, token: str) -> Optional[models.User]:
    payload = _decode(token)
    if not payload:
        return None
    return db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
