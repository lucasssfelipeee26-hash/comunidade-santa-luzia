from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from ..ranking_service import calculate_ranking
from ..security import APP_AUTH_RELEASE, require_moderator
from ..store import DATA_DIR, REPO_ROOT, find_user, mutate_main, now_ms, read_main, revision
from .profiles import _delete_account

router = APIRouter(tags=["app-admin"])
DISPLAY_VERSION = "1.0.6"
REPOSITORY = "lucasssfelipeee26-hash/comunidade-santa-luzia"
DEFAULT_APK_URL = f"https://github.com/{REPOSITORY}/releases/latest/download/santa-luzia.apk"
DEFAULT_SITE = "https://comunidade-santa-luzia-production.up.railway.app"
TRANSITION_APK = f"https://github.com/{REPOSITORY}/releases/download/android-v1.0.6/santa-luzia.apk"
UI_REVISION = "ui-20260818-update-banner-v2"


def response(body: Any, status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _json_config(name: str):
    try:
        value = json.loads((REPO_ROOT / "config" / name).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _positive_int(value: Any, default: int):
    try:
        number = int(value)
        return number if number > 0 else default
    except (TypeError, ValueError):
        return default


def _boolean_env(name: str, default: bool):
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value == "1" or value.lower() == "true"


def android_release():
    config = _json_config("android-release.json")
    configured_code = _positive_int(config.get("versionCode"), 1)
    version_code = max(configured_code, _positive_int(os.getenv("ANDROID_LATEST_VERSION_CODE"), configured_code))
    version_name = str(config.get("versionName") or "") if version_code == configured_code else (os.getenv("ANDROID_LATEST_VERSION_NAME", "").strip() or str(config.get("versionName") or ""))
    highlights_env = os.getenv("ANDROID_UPDATE_HIGHLIGHTS", "").strip()
    highlights = [item.strip() for item in highlights_env.split("|") if item.strip()] if highlights_env else (config.get("highlights") or [])
    return {
        "available": _boolean_env("ANDROID_APK_AVAILABLE", True),
        "versionCode": version_code,
        "versionName": version_name,
        "publishedAt": os.getenv("ANDROID_RELEASE_PUBLISHED_AT", "").strip() or config.get("publishedAt"),
        "required": _boolean_env("ANDROID_UPDATE_REQUIRED", bool(config.get("required"))),
        "highlights": highlights,
        "downloadUrl": f"{DEFAULT_SITE}/api/app/android/download?version={version_code}",
        "apkSize": int(config.get("apkSize") or 0),
        "apkSha256": str(config.get("apkSha256") or ""),
        "releasePageUrl": f"https://github.com/{REPOSITORY}/releases/latest",
    }


def theme_revision():
    path = DATA_DIR / "configuracao-site.json"
    try:
        stat = path.stat()
        value = f"{int(stat.st_mtime * 1000)}-{stat.st_size}"
    except OSError:
        value = "tema-padrao"
    return f"{value}:{UI_REVISION}"


@router.get("/api/app/status")
async def app_status():
    return response(
        {
            "ok": True,
            "appRelease": APP_AUTH_RELEASE,
            "displayVersion": DISPLAY_VERSION,
            "android": android_release(),
            "novidades": _json_config("app-changelog.json"),
            "revisaoDados": revision(),
            "revisaoTema": theme_revision(),
            "servidorEm": now_ms(),
        },
        headers={"Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "Expires": "0"},
    )


async def _download_checked(url: str, expected_size: int, expected_sha: str, filename: str):
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            upstream = await client.get(url, headers={"Cache-Control": "no-cache"})
        if upstream.status_code < 200 or upstream.status_code >= 300:
            return None, "indisponível"
        data = upstream.content
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != expected_size or digest != expected_sha.lower():
            return None, "integridade"
        return Response(
            content=data,
            media_type="application/vnd.android.package-archive",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(data)),
                "X-APK-SHA256": digest,
                "Cache-Control": "private, no-store, max-age=0",
                "X-Content-Type-Options": "nosniff",
            },
        ), None
    except Exception:
        return None, "falha"


@router.get("/api/app/android/download")
async def android_download():
    release = android_release()
    safe_version = re.sub(r"[^0-9A-Za-z._-]", "-", str(release["versionName"]))
    result, error = await _download_checked(
        os.getenv("ANDROID_APK_URL", "").strip() or DEFAULT_APK_URL,
        int(release["apkSize"]),
        str(release["apkSha256"]),
        f"Santa-Luzia-{safe_version}.apk",
    )
    if result:
        return result
    message = "O APK publicado não passou na validação de integridade." if error == "integridade" else "APK Android temporariamente indisponível." if error == "indisponível" else "Falha ao obter a atualização Android."
    return response({"error": message}, 502)


@router.get("/api/app/android/transition")
async def android_transition():
    transition = _json_config("android-transition-code18.json")
    return response({"available": True, "transition": True, **transition, "downloadUrl": "/api/app/android/download-transition"}, headers={"Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff"})


@router.get("/api/app/android/download-transition")
async def android_transition_download():
    transition = _json_config("android-transition-code18.json")
    result, error = await _download_checked(
        TRANSITION_APK,
        int(transition.get("apkSize") or 0),
        str(transition.get("apkSha256") or ""),
        f"Santa-Luzia-{transition.get('versionName')}-code{transition.get('versionCode')}.apk",
    )
    if result:
        return result
    message = "O APK de transição não passou na validação de integridade." if error == "integridade" else "APK de transição temporariamente indisponível." if error == "indisponível" else "Falha ao obter a atualização de transição Android."
    return response({"error": message}, 502)


def _registrations(store: dict[str, Any]):
    rows = [user for user in store["usuarios"] if isinstance(user, dict) and user.get("tipo") == "membro"]
    rows.sort(key=lambda user: int(user.get("criado_em") or 0), reverse=True)
    return [{"id": row.get("id"), "nome": row.get("nome"), "usuario": row.get("usuario"), "email": row.get("email"), "funcao": row.get("funcao"), "status": row.get("status"), "foto": row.get("foto") or None, "criadoEm": row.get("criado_em")} for row in rows]


@router.get("/api/app/admin-dados")
async def admin_data_get(request: Request):
    require_moderator(request)
    from ..utils import cuiaba_now
    year = cuiaba_now().year
    store = read_main()
    ranking = calculate_ranking(year, store)["ranking"]
    return response({"ok": True, "ano": year, "cadastros": _registrations(store), "ranking": [{"usuarioId": row["usuarioId"], "nome": row["nome"], "pontos": row["pontos"], "posicao": row["posicao"]} for row in ranking]}, headers={"Cache-Control": "no-store, max-age=0"})


@router.post("/api/app/admin-dados")
async def admin_data_post(request: Request):
    moderator = require_moderator(request)
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    action = str(body.get("action") or "")
    if action == "excluir_cadastro":
        if str(body.get("confirmacao") or "").strip().upper() != "EXCLUIR":
            return response({"erro": "Digite EXCLUIR para confirmar."}, 400)
        user_id = str(body.get("usuarioId") or "")
        store = read_main()
        target = find_user(user_id, store)
        if not target or target.get("tipo") != "membro":
            return response({"erro": "Cadastro de membro não encontrado."}, 404)
        if not mutate_main(lambda data: _delete_account(data, user_id)):
            return response({"erro": "Não foi possível excluir o cadastro."}, 409)
        return response({"ok": True, "excluido": {"id": target.get("id"), "nome": target.get("nome")}, "cadastros": _registrations(read_main())})
    if action == "resetar_ranking":
        if str(body.get("confirmacao") or "").strip().upper() != "ZERAR":
            return response({"erro": "Digite ZERAR para confirmar."}, 400)
        from ..utils import cuiaba_now
        try:
            year = int(body.get("ano") or cuiaba_now().year)
        except (TypeError, ValueError):
            year = 0
        if year < 2020 or year > 2100:
            return response({"erro": "Ano inválido."}, 400)
        before = calculate_ranking(year, read_main())["ranking"]
        timestamp = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z")
        def reset(data: dict[str, Any]):
            count = 0
            for row in before:
                points = int(row.get("pontos") or 0)
                if points == 0:
                    continue
                data["ranking_ajustes"].append({"id": f"ajuste-{now_ms()}-{count}", "usuario_id": row["usuarioId"], "pontos": -points, "motivo": f"Reset administrativo do placar em {timestamp}", "ano": year, "criado_por": moderator["id"], "criado_em": now_ms()})
                count += 1
            return count
        count = mutate_main(reset)
        after = calculate_ranking(year, read_main())["ranking"]
        return response({"ok": True, "ano": year, "ajustesCriados": count, "ranking": [{"usuarioId": row["usuarioId"], "nome": row["nome"], "pontos": row["pontos"], "posicao": row["posicao"]} for row in after]})
    return response({"erro": "Ação administrativa desconhecida."}, 400)
