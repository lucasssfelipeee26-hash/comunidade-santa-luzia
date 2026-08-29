#!/usr/bin/env python3
from __future__ import annotations

import gzip
import json
import os
import re
import sys
import zlib
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android"
SRC = NATIVE / "app" / "src" / "main"
KOTLIN = SRC / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"
HOME = KOTLIN / "ui" / "SantaLuziaApp.kt"
MATRIX = NATIVE / "PARITY-MATRIX.json"
LITURGY = ROOT / "public" / "offline" / "liturgia-completa"
ILITURGIA = ROOT / "public" / "offline" / "iliturgia"
FINAL = os.getenv("FINAL_NATIVE_RELEASE") == "1"

errors: list[str] = []
notes: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def read(path: Path) -> str:
    require(path.is_file(), f"Arquivo obrigatório ausente: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def audit_matrix() -> None:
    raw = json.loads(read(MATRIX) or "{}")
    require(raw.get("reference", {}).get("version") == "2.0.0-beta.18", "Matriz perdeu a referência Beta 18")
    features = raw.get("features", [])
    require(len(features) >= 25, "Matriz de paridade incompleta")
    ids = [item.get("id") for item in features]
    require(len(ids) == len(set(ids)), "IDs duplicados na matriz de paridade")
    allowed = {"implemented", "foundation", "pending"}
    bad = [f"{item.get('id')}={item.get('status')}" for item in features if item.get("status") not in allowed]
    require(not bad, f"Status inválido na matriz: {', '.join(bad)}")
    pending = [item["id"] for item in features if item["status"] != "implemented"]
    if FINAL:
        require(not pending, "Release final bloqueada: paridade ainda incompleta: " + ", ".join(pending))
    else:
        notes.append(f"Alpha de migração: {len(pending)} item(ns) ainda não marcados como implemented; release final continua bloqueada.")


def audit_no_webview() -> None:
    forbidden_text = ["android.webkit.WebView", "JavascriptInterface", 'loadUrl("file:///android_asset', "evaluateJavascript("]
    forbidden_ext = {".html", ".htm", ".js", ".jsx", ".css", ".tsx", ".ts"}
    for path in SRC.rglob("*"):
        if not path.is_file():
            continue
        require(path.suffix.lower() not in forbidden_ext, f"Interface web proibida no app nativo: {path.relative_to(ROOT)}")
        if path.suffix.lower() in {".kt", ".kts", ".java", ".xml"}:
            text = path.read_text(encoding="utf-8", errors="replace")
            for marker in forbidden_text:
                require(marker not in text, f"Marcador WebView proibido em {path.relative_to(ROOT)}: {marker}")


def function_slice(text: str, name: str, next_name: str) -> str:
    start = text.find(f"private fun {name}")
    end = text.find(f"private fun {next_name}", start + 1)
    if start < 0:
        return ""
    return text[start:] if end < 0 else text[start:end]


def audit_home() -> None:
    text = read(HOME)
    block = function_slice(text, "HomeScreen", "HomeCard")
    require(bool(block), "HomeScreen Compose não localizada")
    calls = re.findall(r"\bHomeCard\s*\((.*?)\)\s*\{", block, flags=re.S)
    require(len(calls) == 4, f"Home deve ter exatamente 4 cards; encontrado {len(calls)}")
    for title in ["Centro Litúrgico", "Escala do Dia", "Biblioteca", "Liturgia Diária"]:
        require(block.count(f'"{title}"') == 1, f"Card {title!r} ausente ou duplicado")
    for index, call in enumerate(calls, start=1):
        require("Icons." in call, f"Card {index} da Home não declara ícone Material")


def audit_navigation() -> None:
    text = read(HOME)
    for marker in [
        'NavItem(Route.Home, "Início"',
        'NavItem(Route.Scale, "Escala"',
        'NavItem(Route.Formation, "Formação"',
        'NavItem(Route.Journey, "Quiz"',
        "AnimatedNavIcon",
        "rememberInfiniteTransition",
        "NavMotion.Home",
    ]:
        require(marker in text, f"Navegação/animação obrigatória ausente: {marker}")
    require('NavItem(Route.Ranking, "Quiz"' not in text, "Quiz não pode apontar para Ranking; deve abrir a Jornada Litúrgica")
    require('label: "Perfil"' not in text, "Perfil não pode substituir Início na barra inferior")


def audit_liturgy() -> None:
    files = sorted(LITURGY.glob("2026-??.json"))
    require(len(files) == 12, f"Liturgia 2026 deve possuir 12 arquivos mensais; encontrado {len(files)}")
    all_days: dict[str, dict] = {}
    for path in files:
        data = json.loads(read(path) or "{}")
        require(data.get("ano") == 2026, f"Ano inválido em {path.name}")
        days = data.get("dias")
        require(isinstance(days, dict), f"Campo dias ausente em {path.name}")
        if isinstance(days, dict):
            overlap = set(all_days).intersection(days)
            require(not overlap, f"Datas duplicadas entre arquivos: {sorted(overlap)[:3]}")
            all_days.update(days)

    current = date(2026, 1, 1)
    end = date(2026, 12, 31)
    missing: list[str] = []
    incomplete: list[str] = []
    while current <= end:
        key = current.isoformat()
        item = all_days.get(key)
        if not isinstance(item, dict):
            missing.append(key)
        else:
            readings = item.get("leituras", {})
            prayers = item.get("oracoes", {})
            first = readings.get("primeiraLeitura", []) if isinstance(readings, dict) else []
            gospel = readings.get("evangelho", []) if isinstance(readings, dict) else []
            collect = prayers.get("coleta", "") if isinstance(prayers, dict) else ""
            if not first or not gospel or not str(collect).strip():
                incomplete.append(key)
        current += timedelta(days=1)
    require(len(all_days) == 365, f"Liturgia 2026 deve conter 365 dias; encontrado {len(all_days)}")
    require(not missing, f"Liturgia com datas ausentes: {missing[:10]}")
    require(not incomplete, f"Liturgia com dados essenciais incompletos: {incomplete[:10]}")
    notes.append("Liturgia offline: 365/365 dias com primeira leitura, Evangelho e coleta.")


def audit_iliturgia_packages() -> None:
    try:
        manifest = json.loads(read(ILITURGIA / "manifest.json") or "{}")
    except json.JSONDecodeError as exc:
        errors.append(f"Manifesto iLiturgia inválido: {exc}")
        return

    require(manifest.get("offline") is True, "Acervo iLiturgia precisa permanecer marcado como offline")
    require(manifest.get("embedded") is True, "Acervo iLiturgia precisa permanecer empacotado no aplicativo")
    categories = manifest.get("categorias")
    require(isinstance(categories, list) and bool(categories), "Manifesto iLiturgia sem categorias")
    if not isinstance(categories, list):
        return

    package_cache: dict[str, list[dict]] = {}

    def load_package(file_name: str) -> list[dict]:
        if file_name in package_cache:
            return package_cache[file_name]
        path = ILITURGIA / file_name
        if not path.is_file():
            errors.append(f"Pacote iLiturgia ausente: {file_name}")
            package_cache[file_name] = []
            return []
        try:
            with gzip.open(path, "rt", encoding="utf-8") as stream:
                package = json.load(stream)
        except (OSError, EOFError, zlib.error, json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors.append(f"Pacote iLiturgia corrompido ou inválido: {file_name}: {exc}")
            package_cache[file_name] = []
            return []
        documents = package.get("documents") if isinstance(package, dict) else None
        if not isinstance(documents, list):
            errors.append(f"Pacote iLiturgia sem lista documents: {file_name}")
            package_cache[file_name] = []
            return []
        package_cache[file_name] = documents
        return documents

    def normalized_path(document: dict) -> str:
        return str(document.get("path") or "").replace("\\", "/").lstrip("/").lower()

    def logical_documents(category_id: str, files: list[str]) -> list[dict]:
        physical = [doc for file_name in files for doc in load_package(file_name)]
        if category_id == "evangelho":
            return [doc for doc in load_package("gerais.html.json.gz") if normalized_path(doc).startswith("evangelho/")]
        if category_id == "geral":
            return [
                doc for doc in load_package("gerais.html.json.gz")
                if not normalized_path(doc).startswith("evangelho/")
                and normalized_path(doc).split("/")[-1] not in {"iglh.htm", "bienal.htm"}
            ]
        if category_id == "oficio":
            extras = [
                doc for doc in load_package("gerais.html.json.gz")
                if normalized_path(doc).split("/")[-1] in {"iglh.htm", "bienal.htm"}
            ]
            return physical + extras
        return physical

    for category in categories:
        if not isinstance(category, dict):
            errors.append("Categoria inválida no manifesto iLiturgia")
            continue
        category_id = str(category.get("id") or "sem-id")
        files = category.get("arquivos")
        if not isinstance(files, list) or not files:
            errors.append(f"Categoria iLiturgia sem pacotes: {category_id}")
            continue
        documents = logical_documents(category_id, [str(name) for name in files])
        expected_total = category.get("total")
        if isinstance(expected_total, int):
            require(
                len(documents) == expected_total,
                f"Total lógico iLiturgia divergente em {category_id}: manifesto={expected_total}, calculado={len(documents)}",
            )

    physical_total = sum(len(documents) for documents in package_cache.values())
    manifest_total = manifest.get("total")
    if isinstance(manifest_total, int):
        require(
            physical_total == manifest_total,
            f"Total físico iLiturgia divergente: manifesto={manifest_total}, pacotes únicos={physical_total}",
        )
    notes.append(f"Acervo iLiturgia offline: {physical_total} documento(s) validados em {len(package_cache)} pacote(s) GZIP únicos.")


def audit_local_first() -> None:
    db = read(KOTLIN / "core" / "data" / "NativeDatabase.kt")
    queue = read(KOTLIN / "core" / "sync" / "SyncWorker.kt")
    repo = read(KOTLIN / "core" / "data" / "SantaLuziaRepository.kt")
    session = read(KOTLIN / "core" / "session" / "SessionStore.kt")
    for marker in ["enableWriteAheadLogging", "PRAGMA synchronous=FULL", "PRAGMA integrity_check", "mutation_queue", "documents"]:
        require(marker in db, f"SQLite local-first sem requisito: {marker}")
    for marker in ["PeriodicWorkRequestBuilder", "NetworkType.CONNECTED", "pendingMutations", "completeMutation", "Result.retry"]:
        require(marker in queue, f"Fila/sincronização sem requisito: {marker}")
    for marker in ["readLocalFirst", "mutateLocalFirst", "database.enqueue", "database.putDocument"]:
        require(marker in repo, f"Repositório local-first sem requisito: {marker}")
    for marker in ["preferencesDataStore", "logged_in", "session_cookie", "saveAuthenticatedSession"]:
        require(marker in session, f"Sessão offline sem requisito: {marker}")


def audit_auditor() -> None:
    auditor = read(KOTLIN / "core" / "audit" / "SantaLuziaAuditor.kt")
    db = read(KOTLIN / "core" / "data" / "NativeDatabase.kt")
    for marker in ["StrictMode", "Choreographer", "frame-jank", "uncaught-exception", "integrityCheck", "exportReport", "clearHistory"]:
        require(marker in auditor, f"Auditor nativo sem requisito: {marker}")
    for marker in ["signature TEXT PRIMARY KEY", "occurrences", "ON CONFLICT(signature)", "occurrences = audit_events.occurrences + 1"]:
        require(marker in db, f"Deduplicação do Auditor ausente: {marker}")
    for forbidden in ["GlitchTip", "Sentry", "sentry", "glitchtip"]:
        require(forbidden not in auditor, f"Dependência externa de auditoria ainda presente: {forbidden}")


def audit_source_language() -> None:
    kotlin_files = list(SRC.rglob("*.kt"))
    java_files = list(SRC.rglob("*.java"))
    require(len(kotlin_files) >= 8, f"Base Kotlin pequena/incompleta: {len(kotlin_files)} arquivo(s)")
    require(not java_files, "A nova aplicação nativa não deve conter implementação Java")
    notes.append(f"Código Android nativo: {len(kotlin_files)} arquivos Kotlin, 0 Java/WebView UI.")


def main() -> int:
    audit_matrix()
    audit_no_webview()
    audit_home()
    audit_navigation()
    audit_liturgy()
    audit_iliturgia_packages()
    audit_local_first()
    audit_auditor()
    audit_source_language()

    print("AUDITORIA DE PARIDADE — SANTA LUZIA KOTLIN/COMPOSE")
    for note in notes:
        print(f"✓ {note}")
    if errors:
        for error in errors:
            print(f"✗ {error}", file=sys.stderr)
        print(f"Resultado: {len(errors)} falha(s).", file=sys.stderr)
        return 1
    print("Resultado: fundação nativa aprovada. A release final permanece bloqueada pela matriz até 100% de paridade.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
