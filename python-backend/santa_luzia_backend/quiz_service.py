from __future__ import annotations

import hashlib
import os
import re
import secrets
import time
import unicodedata
from typing import Any

import jwt

from .liturgy_service import local_liturgy
from .store import mutate_main, now_ms, read_main
from .utils import cuiaba_date_iso


def daily_quiz_id(date_iso: str) -> str:
    return f"liturgia-auto:{date_iso}"


def normalize_reference(value: Any) -> str:
    text = str(value or "").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    text = re.sub(r"\s*,\s*", ",", text)
    text = re.sub(r"\s*;\s*", "; ", text)
    text = re.sub(r"\s*\.\s*", ".", text)
    text = re.sub(r"\s*[-–—]\s*", "–", text)
    text = re.sub(r"\s*:\s*", ":", text)
    text = re.sub(r";\s*", "; ", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def _norm(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").strip().lower())
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def _unique(values: list[Any]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        value = re.sub(r"\s+", " ", str(raw or "")).strip()
        if not value:
            continue
        key = _norm(value)
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _score(seed: str) -> int:
    return int.from_bytes(hashlib.sha256(seed.encode()).digest()[:4], "big")


def _shuffle(items: list[Any], seed: str) -> list[Any]:
    decorated = [(item, _score(f"{seed}:{index}:{item}")) for index, item in enumerate(items)]
    decorated.sort(key=lambda pair: pair[1])
    return [item for item, _ in decorated]


def _excerpt(text: Any) -> str:
    lines = [re.sub(r"\s+", " ", part).strip() for part in re.split(r"\n+", str(text or ""))]
    lines = [part for part in lines if len(part) >= 30]
    chosen = next((part for part in lines if not re.search(r"Palavra da Salvação|Glória a vós|Palavra do Senhor", part, re.I)), lines[0] if lines else "")
    return f"{chosen[:127].strip()}…" if len(chosen) > 130 else chosen


def _question(question_id: str, prompt: str, correct: str, alternatives: list[str], seed: str):
    options_base = _unique([correct, *alternatives])
    if not correct or len(options_base) < 3:
        return None
    options = _shuffle(options_base[:3], f"{seed}:{question_id}")
    correct_index = next((index for index, item in enumerate(options) if _norm(item) == _norm(correct)), -1)
    if correct_index < 0:
        return None
    return {"id": question_id, "enunciado": prompt, "opcoes": options, "correta": correct_index, "pontos": 10}


def generate_daily_questions(liturgy: dict[str, Any], seed: str) -> list[dict[str, Any]]:
    readings = liturgy.get("leituras") if isinstance(liturgy.get("leituras"), dict) else {}
    first = (readings.get("primeiraLeitura") or [None])[0]
    psalm = (readings.get("salmo") or [None])[0]
    second = (readings.get("segundaLeitura") or [None])[0]
    gospel = (readings.get("evangelho") or [None])[0]
    first = first if isinstance(first, dict) else {}
    psalm = psalm if isinstance(psalm, dict) else {}
    second = second if isinstance(second, dict) else {}
    gospel = gospel if isinstance(gospel, dict) else {}
    first_ref = normalize_reference(first.get("referencia"))
    psalm_ref = normalize_reference(psalm.get("referencia"))
    second_ref = normalize_reference(second.get("referencia"))
    gospel_ref = normalize_reference(gospel.get("referencia"))
    references = _unique([gospel_ref, first_ref, second_ref, psalm_ref])
    colors = ["Branco", "Verde", "Roxo", "Vermelho", "Rosa"]
    seasons = ["Advento", "Quaresma", "Tempo Comum", "Tempo Pascal", "Tempo do Natal", "Tríduo Pascal"]
    color = re.sub(r"^Cor Litúrgica:\s*", "", str(liturgy.get("cor") or ""), flags=re.I).strip()
    season = str(liturgy.get("tempoLiturgicoAtual") or "").strip()
    candidates = [
        _question("cor-liturgica", "Qual é a cor litúrgica indicada para a celebração de hoje?", color, [item for item in colors if _norm(item) != _norm(color)], seed),
        _question("tempo-liturgico", "Qual tempo litúrgico aparece na Liturgia de hoje?", season, [item for item in seasons if _norm(item) not in _norm(season) and _norm(season) not in _norm(item)], seed),
        _question("referencia-evangelho", "Qual destas referências corresponde ao Evangelho de hoje?", gospel_ref, [item for item in references if _norm(item) != _norm(gospel_ref)], seed),
        _question("referencia-primeira", "Qual destas referências corresponde à Primeira Leitura de hoje?", first_ref, [item for item in references if _norm(item) != _norm(first_ref)], seed),
        _question("trecho-evangelho", "Qual destes trechos pertence ao Evangelho de hoje?", _excerpt(gospel.get("texto")), [_excerpt(first.get("texto")), _excerpt(second.get("texto")), _excerpt(psalm.get("texto"))], seed),
        _question("refrao-salmo", "Qual é o refrão apresentado no Salmo Responsorial de hoje?", str(psalm.get("refrao") or ""), [_excerpt(first.get("texto")), _excerpt(gospel.get("texto")), _excerpt(second.get("texto"))], seed),
    ]
    valid = [item for item in candidates if item]
    return _shuffle(valid, f"{seed}:ordem")[:5]


def _attempt_secret() -> str:
    value = os.getenv("AUTH_SECRET", "").strip()
    if not value:
        raise RuntimeError("AUTH_SECRET não configurado para o Quiz Litúrgico.")
    return value


def create_attempt(user_id: str) -> dict[str, Any]:
    date_iso = cuiaba_date_iso()
    nonce = secrets.token_hex(12)
    expires_ms = now_ms() + 90_000
    payload = {"uid": user_id, "data": date_iso, "nonce": nonce, "expiraEm": expires_ms, "tipo": "quiz-liturgia", "iat": int(time.time()), "exp": int(expires_ms / 1000) + 5}
    token = jwt.encode(payload, _attempt_secret(), algorithm="HS256")
    return {"token": token, "data": date_iso, "nonce": nonce, "expiraEm": expires_ms, "duracaoSegundos": 90}


def validate_attempt(token: str, user_id: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _attempt_secret(), algorithms=["HS256"])
    except Exception as exc:
        raise ValueError("Tentativa inválida.") from exc
    if payload.get("tipo") != "quiz-liturgia" or payload.get("uid") != user_id or not isinstance(payload.get("data"), str) or not isinstance(payload.get("nonce"), str) or not isinstance(payload.get("expiraEm"), (int, float)):
        raise ValueError("Tentativa inválida.")
    if now_ms() > int(payload["expiraEm"]):
        raise ValueError("O tempo desta tentativa terminou.")
    if payload["data"] != cuiaba_date_iso():
        raise ValueError("Esta tentativa não pertence à Liturgia de hoje.")
    return {"uid": user_id, "data": payload["data"], "nonce": payload["nonce"], "expiraEm": int(payload["expiraEm"])}


def _offline_options(correct: str, others: list[str], rotation: int):
    base = [correct, *[item for item in others if item and item != correct]][:3]
    while len(base) < 3:
        base.append("Não consta na Liturgia de hoje" if len(base) == 1 else "Outra referência")
    n = rotation % 3
    items = [*base[n:], *base[:n]]
    return items, items.index(correct)


def ensure_offline_liturgy_quiz(date_iso: str) -> dict[str, Any] | None:
    liturgy = local_liturgy(date_iso)
    if not liturgy:
        return None
    store = read_main()
    existing = next((quiz for quiz in store["quizzes"] if isinstance(quiz, dict) and quiz.get("origem") == "liturgia" and quiz.get("data_referencia") == date_iso and quiz.get("referencia_id") == f"liturgia-offline:{date_iso}"), None)
    if existing:
        return existing
    readings = liturgy.get("leituras") if isinstance(liturgy.get("leituras"), dict) else {}
    first = ((readings.get("primeiraLeitura") or [{}])[0]) or {}
    psalm = ((readings.get("salmo") or [{}])[0]) or {}
    second = ((readings.get("segundaLeitura") or [{}])[0]) or {}
    gospel = ((readings.get("evangelho") or [{}])[0]) or {}
    refs = [str(value) for value in [first.get("referencia"), psalm.get("referencia"), second.get("referencia"), gospel.get("referencia")] if value]
    questions: list[dict[str, Any]] = []
    if first.get("referencia"):
        items, correct = _offline_options(str(first["referencia"]), [x for x in refs if x != first["referencia"]], 1)
        questions.append({"id": "lit-1", "enunciado": "Qual é a referência da Primeira Leitura da Liturgia de hoje?", "opcoes": items, "correta": correct, "pontos": 10, "explicacao": f"A Primeira Leitura é {first['referencia']}."})
    if psalm.get("referencia"):
        items, correct = _offline_options(str(psalm["referencia"]), [x for x in refs if x != psalm["referencia"]], 2)
        questions.append({"id": "lit-2", "enunciado": "Qual é a referência do Salmo Responsorial de hoje?", "opcoes": items, "correta": correct, "pontos": 10, "explicacao": f"O Salmo Responsorial é {psalm['referencia']}."})
    if psalm.get("refrao"):
        items, correct = _offline_options(str(psalm["refrao"]), ["O Senhor é meu pastor e nada me faltará.", "Provai e vede como o Senhor é bom."], 1)
        questions.append({"id": "lit-3", "enunciado": "Qual é o refrão do Salmo Responsorial apresentado na Liturgia de hoje?", "opcoes": items, "correta": correct, "pontos": 15, "explicacao": f"Refrão: {psalm['refrao']}"})
    if gospel.get("referencia"):
        items, correct = _offline_options(str(gospel["referencia"]), [x for x in refs if x != gospel["referencia"]], 0)
        questions.append({"id": "lit-4", "enunciado": "Qual é a referência do Evangelho proclamado hoje?", "opcoes": items, "correta": correct, "pontos": 15, "explicacao": f"O Evangelho é {gospel['referencia']}."})
    period = str(liturgy.get("tempoLiturgicoAtual") or "").strip()
    if period:
        items, correct = _offline_options(period, ["Tempo do Advento", "Tempo Pascal"], 2)
        questions.append({"id": "lit-5", "enunciado": "Em qual período litúrgico está inserida a celebração de hoje?", "opcoes": items, "correta": correct, "pontos": 10, "explicacao": period})
    if len(questions) < 3:
        return None
    def save(data: dict[str, Any]):
        duplicate = next((quiz for quiz in data["quizzes"] if isinstance(quiz, dict) and quiz.get("origem") == "liturgia" and quiz.get("data_referencia") == date_iso and quiz.get("referencia_id") == f"liturgia-offline:{date_iso}"), None)
        if duplicate:
            return duplicate
        current = now_ms()
        row = {"id": f"quiz-{current}-{secrets.token_hex(3)}", "titulo": f"Quiz da Liturgia — {'/'.join(reversed(date_iso.split('-')))}", "descricao": "Gerado automaticamente e exclusivamente a partir da mesma base offline exibida na Central de Liturgia.", "origem": "liturgia", "referencia_id": f"liturgia-offline:{date_iso}", "data_referencia": date_iso, "ativo": True, "perguntas": questions, "criado_por": "sistema-liturgia-offline", "criado_em": current, "atualizado_em": current}
        data["quizzes"].append(row)
        return row
    return mutate_main(save)
