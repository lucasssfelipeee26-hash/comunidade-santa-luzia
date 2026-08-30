from __future__ import annotations

import io
import json
import os
import re
import shutil
import tarfile
import tempfile
from pathlib import Path
from typing import Any

from .store import DATA_DIR, REPO_ROOT

ARCHIVE_DIR = DATA_DIR / "acervo-liturgico"
EMBEDDED_DIR = REPO_ROOT
EMBEDDED_CATEGORIES = [
    {"id": "catequeses", "nome": "Catequeses", "total": 56, "arquivos": ["catequeses.html.json.gz"]},
    {"id": "comentarios", "nome": "Comentários", "total": 25, "arquivos": ["comentarios.html.json.gz"]},
    {"id": "evangelho", "nome": "Evangelhos e Lectio Divina", "total": 469, "arquivos": ["evangelhos.html.json.gz"]},
    {"id": "geral", "nome": "Documentos gerais", "total": 7, "arquivos": ["gerais.html.json.gz"]},
    {"id": "lecionario", "nome": "Lecionário", "total": 736, "arquivos": ["lecionario.html.json.gz"]},
    {"id": "missal", "nome": "Missal e ritos", "total": 387, "arquivos": ["missal.html.json.gz"]},
    {"id": "oficio", "nome": "Liturgia das Horas / Ofício", "total": 3749, "arquivos": [f"oficio-{i:02d}.html.json.gz" for i in range(1, 11)]},
    {"id": "rosario", "nome": "Santo Rosário", "total": 4, "arquivos": ["rosario.html.json.gz"]},
    {"id": "salterio", "nome": "Saltério", "total": 1, "arquivos": ["salterio.html.json.gz"]},
]
EMBEDDED_MANIFEST = {
    "version": 2,
    "offline": True,
    "embedded": True,
    "htmlPreservado": True,
    "imagensImportadas": False,
    "total": 5434,
    "origem": "Acervo litúrgico autorizado incorporado ao aplicativo",
    "categorias": EMBEDDED_CATEGORIES,
}
ALLOWED_RE = re.compile(r"^[a-z0-9.-]+\.json\.gz$", re.I)


def valid_archive_filename(name: str) -> bool:
    return name == "manifest.json" or bool(ALLOWED_RE.fullmatch(name))


def _manifest_files(manifest: Any) -> list[str] | None:
    if not isinstance(manifest, dict) or not int(manifest.get("total") or 0) or not isinstance(manifest.get("categorias"), list) or not manifest["categorias"]:
        return None
    files: set[str] = set()
    for category in manifest["categorias"]:
        if not isinstance(category, dict) or not isinstance(category.get("arquivos"), list) or not category["arquivos"]:
            return None
        for raw in category["arquivos"]:
            if not isinstance(raw, str) or Path(raw).name != raw or raw == "manifest.json" or not valid_archive_filename(raw):
                return None
            files.add(raw)
    return sorted(files)


def persistent_manifest() -> dict[str, Any] | None:
    path = ARCHIVE_DIR / "manifest.json"
    if not path.exists():
        return None
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    files = _manifest_files(manifest)
    if not files or any(not (ARCHIVE_DIR / name).exists() for name in files):
        return None
    return manifest


def archive_manifest() -> dict[str, Any] | None:
    persistent = persistent_manifest()
    if persistent:
        return persistent
    if (EMBEDDED_DIR / "lecionario.html.json.gz").exists() and (EMBEDDED_DIR / "oficio-01.html.json.gz").exists():
        return EMBEDDED_MANIFEST
    return None


def archive_file(name: str) -> Path | None:
    if not valid_archive_filename(name) or Path(name).name != name:
        return None
    if persistent_manifest():
        candidate = (ARCHIVE_DIR / name).resolve()
        if candidate.parent == ARCHIVE_DIR.resolve() and candidate.exists():
            return candidate
    if name != "manifest.json":
        embedded = (EMBEDDED_DIR / name).resolve()
        if embedded.parent == EMBEDDED_DIR.resolve() and embedded.exists():
            return embedded
    candidate = (ARCHIVE_DIR / name).resolve()
    return candidate if candidate.parent == ARCHIVE_DIR.resolve() and candidate.exists() else None


def archive_status() -> dict[str, Any]:
    manifest = archive_manifest()
    if not manifest:
        return {"instalado": False, "total": 0, "categorias": 0}
    categories = manifest.get("categorias") if isinstance(manifest.get("categorias"), list) else []
    return {"instalado": True, "total": int(manifest.get("total") or 0), "categorias": len(categories), "versao": int(manifest.get("version") or 1)}


def install_tar(payload: bytes) -> dict[str, Any]:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="acervo-liturgico-", dir=str(DATA_DIR)))
    written: list[str] = []
    try:
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:") as archive:
            for member in archive.getmembers():
                if not member.isfile():
                    continue
                name = Path(member.name).name
                if member.name != name or not valid_archive_filename(name):
                    continue
                source = archive.extractfile(member)
                if source is None:
                    continue
                (temp_dir / name).write_bytes(source.read())
                written.append(name)
        if "manifest.json" not in written:
            raise ValueError("O pacote não contém manifest.json.")
        manifest = json.loads((temp_dir / "manifest.json").read_text(encoding="utf-8"))
        expected = _manifest_files(manifest)
        if not expected:
            raise ValueError("Manifesto do acervo inválido.")
        missing = [name for name in expected if name not in written or not (temp_dir / name).exists()]
        if missing:
            sample = ", ".join(missing[:4]) + ("…" if len(missing) > 4 else "")
            raise ValueError(f"Pacote incompleto. Arquivos ausentes: {sample}")
        for name in written:
            if name != "manifest.json":
                shutil.copyfile(temp_dir / name, ARCHIVE_DIR / name)
        shutil.copyfile(temp_dir / "manifest.json", ARCHIVE_DIR / "manifest.json")
        return {**archive_status(), "arquivos": len(written)}
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
