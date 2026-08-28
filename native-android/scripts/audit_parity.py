#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android"
SRC = NATIVE / "app" / "src" / "main"
KOTLIN = SRC / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"
HOME = KOTLIN / "ui" / "SantaLuziaApp.kt"
MATRIX = NATIVE / "PARITY-MATRIX.json"
LITURGY = ROOT / "public" / "offline" / "liturgia-completa"
FINAL = os.getenv("FINAL_NATIVE_RELEASE") == "1"

errors: list[str] = []
notes: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def read(path: Path) -> str:
    require(path.is_file(), f"Arquivo obrigatório ausente: {path.relative_to(ROOT)}")
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


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
    forbidden_text = [
        "android.webkit.WebView",
        "JavascriptInterface",
        "loadUrl(\"file:///android_asset",
        "evaluateJavascript(",
    ]
    forbidden_ext = {".html", ".htm", ".js", ".jsx", ".css", ".tsx", ".ts"}
    for path in SRC.rglob("*"):
        if path.is_file():
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
    expected = ["Centro Litúrgico", "Escala do Dia", "Biblioteca", "Liturgia Diária"]
    for title in expected:
        require(block.count(f'"{title}"') == 1, f"Card {title!r} ausente ou duplicado")
    # Cada chamada precisa carregar um ícone Material próprio; aceita argumentos
    # posicionais ou nomeados para não acoplar o gate ao estilo de formatação Kotlin.
    for index, call in enumerate(calls, start=1):
        require("Icons." in call, f"Card {index} da Home não declara ícone Material")
    require("Liturgia Diária" in block, "Card Liturgia Diária ausente")
    without_expected = re.sub(r"Liturgia Diária|Centro Litúrgico", "", block)
    require('HomeCard' not in without_expected.replace('HomeCard', '', 4), "Há acesso/card extra na Home")


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
