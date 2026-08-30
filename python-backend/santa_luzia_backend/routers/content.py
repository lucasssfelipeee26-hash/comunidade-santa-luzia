from __future__ import annotations

import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import json5
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..liturgy_service import local_liturgy
from ..store import REPO_ROOT
from ..utils import cuiaba_date_iso, valid_date_iso

router = APIRouter(tags=["content"])


def response(body: Any, status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _first_advent_sunday(year: int) -> date:
    reference = date(year, 11, 27)
    return reference + timedelta(days=(6 - reference.weekday()) % 7)


def liturgical_cycles(date_iso: str):
    parsed = date.fromisoformat(date_iso)
    liturgical_year = parsed.year + 1 if parsed >= _first_advent_sunday(parsed.year) else parsed.year
    remainder = liturgical_year % 3
    sunday = "A" if remainder == 1 else "B" if remainder == 2 else "C"
    weekday = "II" if liturgical_year % 2 == 0 else "I"
    return {"anoLiturgico": liturgical_year, "cicloDominical": sunday, "cicloFerial": weekday}


def _long_date(date_iso: str):
    names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
    parsed = date.fromisoformat(date_iso)
    return f"{parsed.day:02d} de {names[parsed.month - 1]} de {parsed.year}"


def _normalize_reference(value: Any) -> str:
    text = str(value or "").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*,\s*", ",", text)
    text = re.sub(r"\s*;\s*", "; ", text)
    text = re.sub(r"\s*\.\s*", ".", text)
    text = re.sub(r"\s*[-–—]\s*", "–", text)
    text = re.sub(r"\s*:\s*", ":", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def _normalize_readings(readings: Any):
    if not isinstance(readings, dict):
        return readings
    result = {}
    for key in ("primeiraLeitura", "salmo", "segundaLeitura", "evangelho", "extras"):
        values = readings.get(key)
        if not isinstance(values, list):
            result[key] = values
            continue
        normalized = []
        for raw in values:
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            if item.get("referencia"):
                item["referencia"] = _normalize_reference(item["referencia"])
            normalized.append(item)
        result[key] = normalized
    return result


def _liturgy_payload(date_iso: str, *, normalize: bool = False):
    local = local_liturgy(date_iso)
    if not local:
        return None
    payload = dict(local)
    if normalize:
        payload["leituras"] = _normalize_readings(payload.get("leituras"))
    payload.update(liturgical_cycles(date_iso))
    payload["dataIso"] = date_iso
    payload["data"] = payload.get("data") or _long_date(date_iso)
    payload["origem"] = "offline"
    payload["offline"] = True
    readings = payload.get("leituras") if isinstance(payload.get("leituras"), dict) else {}
    if normalize:
        payload["quizDisponivel"] = bool(
            any(isinstance(item, dict) and item.get("texto") for item in readings.get("primeiraLeitura") or [])
            or any(isinstance(item, dict) and item.get("texto") for item in readings.get("evangelho") or [])
        )
    else:
        payload["quizDisponivel"] = True
    source = payload.get("fonte") if isinstance(payload.get("fonte"), dict) else {}
    payload["fonte"] = {
        "nome": source.get("nome") or "Base offline Santa Luzia",
        **({"licenca": source.get("licenca")} if source.get("licenca") else {}),
        **({"arquivoOrigem": source.get("arquivoOrigem")} if source.get("arquivoOrigem") else {}),
    }
    if normalize and isinstance(payload.get("santoDoDia"), dict):
        payload["santoDoDia"] = {**payload["santoDoDia"], "fonte": "Base offline"}
    return payload


@router.get("/api/liturgia")
async def liturgy(request: Request):
    windows = "SantaLuziaWindowsBeta/" in request.headers.get("user-agent", "") or request.headers.get("x-santa-luzia-windows-beta") == "1"
    requested = str(request.query_params.get("data") or "")
    date_iso = requested if windows and valid_date_iso(requested) else cuiaba_date_iso()
    payload = _liturgy_payload(date_iso)
    if not payload:
        return response({"erro": "Liturgia offline indisponível para esta data.", "offline": True, "dataIso": date_iso, "quizDisponivel": False}, 404, {"Cache-Control": "no-store"})
    return response(payload, headers={"Cache-Control": "public, max-age=3600, immutable"})


@router.get("/api/liturgia-local")
async def local_liturgy_api():
    date_iso = cuiaba_date_iso()
    payload = _liturgy_payload(date_iso, normalize=True)
    if not payload:
        return response({"erro": "A Liturgia de hoje ainda não está disponível na base offline.", "offline": True, "dataIso": date_iso, "quizDisponivel": False}, 404, {"Cache-Control": "no-store"})
    return response(payload, headers={"Cache-Control": "public, max-age=3600"})


def _extract_ts_array(path: Path, marker: str):
    text = path.read_text(encoding="utf-8")
    start_marker = text.find(marker)
    if start_marker < 0:
        return []
    start = text.find("[", start_marker)
    if start < 0:
        return []
    depth = 0
    in_string: str | None = None
    escaped = False
    for index in range(start, len(text)):
        ch = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == in_string:
                in_string = None
            continue
        if ch in {"'", '"', "`"}:
            in_string = ch
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return json5.loads(text[start:index + 1])
    return []


@router.get("/api/biblioteca")
async def library():
    books = _extract_ts_array(REPO_ROOT / "lib" / "biblioteca.ts", "export const livrosBiblioteca")
    public = []
    for book in books if isinstance(books, list) else []:
        if not isinstance(book, dict):
            continue
        public.append({
            "id": book.get("id"), "titulo": book.get("titulo"), "subtitulo": book.get("subtitulo") or None,
            "autor": book.get("autor"), "categoria": book.get("categoria"), "santo": book.get("santo") or None,
            "paginas": book.get("paginas") or None, "edicao": book.get("edicao") or None,
            "periodo": book.get("periodo") or None, "descricao": book.get("descricao"),
            "downloadUrl": book.get("downloadUrl"), "fonteUrl": book.get("fonteUrl"),
            "hospedagem": book.get("hospedagem"), "destaque": bool(book.get("destaque")),
            "downloadDireto": bool(book.get("downloadDireto")),
        })
    return response({"livros": public}, headers={"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"})
