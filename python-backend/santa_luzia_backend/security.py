from __future__ import annotations

import hashlib
import os
import time
from typing import Any

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response, status

from .store import find_user, read_main

COOKIE_NAME = "santa_luzia_sessao"
APP_AUTH_RELEASE = "0.11.0"
SESSION_SECONDS = 60 * 60 * 24 * 400
DEFAULT_DEV_SECRET = "dev-somente-troque-este-segredo-em-producao-santa-luzia"


def _secret() -> str:
    value = os.getenv("AUTH_SECRET", "").strip()
    environment = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).lower()
    if not value and environment == "production":
        raise RuntimeError("AUTH_SECRET não configurado para o backend Python em produção.")
    return value or DEFAULT_DEV_SECRET


def password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def password_matches(password: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


def credential_fingerprint(stored_hash: str) -> str:
    return hashlib.sha256(f"santa-luzia:{stored_hash}".encode("utf-8")).hexdigest()


def issue_session(response: Response, user: dict[str, Any]) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user["id"]),
        "tipo": str(user["tipo"]),
        "versao": APP_AUTH_RELEASE,
        "cred": credential_fingerprint(str(user.get("senha_hash") or "")),
        "iat": now,
        "exp": now + SESSION_SECONDS,
    }
    token = jwt.encode(payload, _secret(), algorithm="HS256")
    production = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).lower() == "production"
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=production,
        samesite="lax",
        path="/",
        max_age=SESSION_SECONDS,
    )
    return token


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def _decode_session(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except Exception:
        return None
    if payload.get("versao") != APP_AUTH_RELEASE:
        return None
    if payload.get("tipo") not in {"moderador", "membro"}:
        return None
    if not isinstance(payload.get("sub"), str):
        return None
    return payload


def current_user(request: Request) -> dict[str, Any] | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
    if not token:
        return None
    payload = _decode_session(token)
    if not payload:
        return None
    store = read_main()
    user = find_user(str(payload["sub"]), store)
    if not user:
        return None
    if user.get("tipo") == "membro" and user.get("status") != "aprovado":
        return None
    credential = payload.get("cred")
    if isinstance(credential, str) and credential != credential_fingerprint(str(user.get("senha_hash") or "")):
        return None
    return user


def require_user(request: Request) -> dict[str, Any]:
    user = current_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autorizado.")
    return user


def require_moderator(request: Request) -> dict[str, Any]:
    user = require_user(request)
    if user.get("tipo") != "moderador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas moderadores.")
    return user
