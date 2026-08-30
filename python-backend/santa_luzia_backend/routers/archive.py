from __future__ import annotations

import gzip
import json
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from ..archive_service import EMBEDDED_DIR, archive_file, archive_manifest, archive_status, install_tar
from ..security import require_moderator

router = APIRouter(tags=["archive"])
PACKAGES = {
    "catequeses": ["catequeses.html.json.gz"],
    "comentarios": ["comentarios.html.json.gz"],
    "evangelho": ["evangelhos.html.json.gz"],
    "geral": ["gerais.html.json.gz"],
    "lecionario": ["lecionario.html.json.gz"],
    "missal": ["missal.html.json.gz"],
    "rosario": ["rosario.html.json.gz"],
    "salterio": ["salterio.html.json.gz"],
    "oficio": [f"oficio-{i:02d}.html.json.gz" for i in range(1, 11)],
}
EMBEDDED_ALLOWED = {name for names in PACKAGES.values() for name in names}
_cache: dict[str, dict[str, Any]] = {}


def response(body: Any, status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _normalize(value: str) -> str:
    return value.lstrip("/").replace("\\", "/").lower()


def _base(value: str) -> str:
    return _normalize(value).split("/")[-1]


def _loose(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\.html?$", "", _base(value), flags=re.I))


def _load_package(name: str):
    if name in _cache:
        return _cache[name]
    path = archive_file(name) or (EMBEDDED_DIR / name if name in EMBEDDED_ALLOWED else None)
    if not path or not path.exists():
        raise FileNotFoundError(name)
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        package = json.load(stream)
    _cache[name] = package
    return package


def _find_document(documents: list[dict[str, Any]], target: str):
    normalized = _normalize(target)
    exact = next((doc for doc in documents if _normalize(str(doc.get("path") or "")) == normalized or _normalize(str(doc.get("id") or "")) == normalized), None)
    if exact:
        return exact
    target_base = _base(normalized)
    by_base = [doc for doc in documents if _base(str(doc.get("path") or "")) == target_base or _base(str(doc.get("id") or "")) == target_base]
    if len(by_base) == 1:
        return by_base[0]
    target_loose = _loose(normalized)
    by_loose = [doc for doc in documents if _loose(str(doc.get("path") or "")) == target_loose or _loose(str(doc.get("id") or "")) == target_loose]
    return by_loose[0] if len(by_loose) == 1 else None


@router.get("/api/acervo-liturgico/manifest")
async def manifest():
    value = archive_manifest()
    if not value:
        return response({"erro": "Acervo litúrgico offline ainda não foi instalado."}, 404, {"Cache-Control": "no-store"})
    return response(value, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/api/acervo-liturgico/arquivo")
async def archive_file_api(request: Request):
    name = str(request.query_params.get("nome") or "")
    path = archive_file(name)
    if not path or not path.exists():
        return response({"erro": "Arquivo do acervo não encontrado."}, 404)
    return FileResponse(
        path,
        media_type="application/gzip" if name.endswith(".json.gz") else "application/json; charset=utf-8",
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/api/acervo-embutido")
async def embedded_archive(request: Request):
    name = str(request.query_params.get("nome") or "")
    if name not in EMBEDDED_ALLOWED:
        return response({"error": "Documento não permitido"}, 404)
    path = EMBEDDED_DIR / name
    if not path.exists():
        return response({"error": "Pacote litúrgico não encontrado"}, 404)
    return FileResponse(path, media_type="application/gzip", headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/api/acervo-documento")
async def archive_document(request: Request):
    category = str(request.query_params.get("categoria") or "")
    raw = str(request.query_params.get("documento") or "")
    alternatives = [_normalize(item) for item in raw.split("||") if item.strip()]
    package_names = PACKAGES.get(category)
    if not package_names or not alternatives:
        return response({"error": "Parâmetros inválidos"}, 400)
    try:
        documents: list[dict[str, Any]] = []
        for name in package_names:
            package = _load_package(name)
            if isinstance(package, dict) and isinstance(package.get("documents"), list):
                documents.extend(doc for doc in package["documents"] if isinstance(doc, dict))
        for alternative in alternatives:
            found = _find_document(documents, alternative)
            if found:
                return response(found, headers={"Cache-Control": "public, max-age=86400"})
        # Compatibilidade tolerante: quando o caminho específico do Ofício mudou entre versões,
        # tenta a chave sem pasta antes de declarar ausência. As regras calendáricas detalhadas
        # continuam sendo resolvidas no cliente nativo a partir do acervo completo local.
        if category == "oficio":
            for alternative in alternatives:
                found = _find_document(documents, _base(alternative))
                if found:
                    return response(found, headers={"Cache-Control": "public, max-age=86400"})
        return response({"error": "Documento não localizado no acervo interno", "documento": alternatives[0], "alternativas": alternatives}, 404)
    except Exception:
        return response({"error": "Falha ao consultar o acervo interno"}, 500)


@router.get("/api/admin/acervo-liturgico")
async def archive_admin_status(request: Request):
    require_moderator(request)
    return response(archive_status(), headers={"Cache-Control": "no-store"})


@router.post("/api/admin/acervo-liturgico")
async def archive_admin_install(request: Request):
    require_moderator(request)
    try:
        form = await request.form()
    except Exception:
        form = None
    upload = form.get("arquivo") if form else None
    if not isinstance(upload, UploadFile):
        return response({"erro": "Selecione o pacote .tar do acervo litúrgico."}, 400)
    name = str(upload.filename or "")
    if not name.lower().endswith(".tar"):
        return response({"erro": "O arquivo deve estar no formato .tar."}, 400)
    payload = await upload.read(30 * 1024 * 1024 + 1)
    if len(payload) > 30 * 1024 * 1024:
        return response({"erro": "O pacote excede o limite de 30 MB."}, 413)
    try:
        result = install_tar(payload)
    except Exception as error:
        return response({"erro": str(error) or "Não foi possível instalar o acervo."}, 400)
    _cache.clear()
    return response({"ok": True, **result}, headers={"Cache-Control": "no-store"})
