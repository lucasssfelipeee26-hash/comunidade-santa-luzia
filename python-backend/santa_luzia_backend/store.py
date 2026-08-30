from __future__ import annotations

import json
import os
import re
import threading
import time
import unicodedata
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, TypeVar

try:
    import fcntl  # type: ignore
except ImportError:  # pragma: no cover - Windows development only
    fcntl = None

T = TypeVar("T")

PACKAGE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_DIR.parents[1]
DATA_DIR = Path(os.getenv("DATA_DIR", str(REPO_ROOT / "data"))).resolve()
DB_PATH = DATA_DIR / "santa-luzia.json"
NOTIFICATIONS_PATH = DATA_DIR / "notificacoes.json"
CONSTANCY_PATH = DATA_DIR / "constancia-luz.json"
SETTINGS_PATH = DATA_DIR / "configuracao.json"
FORMATIONS_DIR = DATA_DIR / "formacoes"
LITURGY_ARCHIVE_DIR = DATA_DIR / "acervo-liturgico"

MAIN_COLLECTIONS = (
    "usuarios",
    "registros",
    "codigos_recuperacao",
    "escalas",
    "escala_justificativas",
    "formacoes",
    "formacao_presencas",
    "reconhecimentos",
    "quizzes",
    "quiz_respostas",
    "pontualidade_ocorrencias",
    "pontualidade_reacoes",
    "ranking_ajustes",
    "ranking_configs",
)

_process_lock = threading.RLock()


def now_ms() -> int:
    return int(time.time() * 1000)


def normalize_username(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").strip().lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\s+", ".", text)
    text = re.sub(r"[^a-z0-9._-]", "", text)
    text = re.sub(r"\.{2,}", ".", text)
    return text.strip("._-")


def normalize_email(value: Any) -> str:
    return str(value or "").strip().lower()


def _default_main() -> dict[str, Any]:
    return {key: [] for key in MAIN_COLLECTIONS}


def _coerce_main(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    result = dict(source)
    for key in MAIN_COLLECTIONS:
        if not isinstance(result.get(key), list):
            result[key] = []
    return result


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        backup = path.with_name(f"{path.name}.corrompido-{now_ms()}.bak")
        try:
            backup.write_bytes(path.read_bytes())
        except Exception:
            pass
        raise RuntimeError(f"Armazenamento JSON inválido: {path}")


def _write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


@contextmanager
def _file_lock(path: Path):
    lock_path = path.with_name(path.name + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    stream = lock_path.open("a+")
    try:
        if fcntl is not None:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        if fcntl is not None:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        stream.close()


def read_main() -> dict[str, Any]:
    with _process_lock:
        return _coerce_main(_read_json(DB_PATH, _default_main()))


def mutate_main(mutator: Callable[[dict[str, Any]], T]) -> T:
    with _process_lock, _file_lock(DB_PATH):
        store = _coerce_main(_read_json(DB_PATH, _default_main()))
        result = mutator(store)
        _write_json_atomic(DB_PATH, store)
        return result


def revision() -> str:
    try:
        stat = DB_PATH.stat()
        return f"{int(stat.st_mtime * 1000)}-{stat.st_size}"
    except OSError:
        return "sem-dados"


def generate_user_id(name: str, store: dict[str, Any] | None = None) -> str:
    base = normalize_username(name).replace(".", "-") or "usuario"
    source = store or read_main()
    used = {str(user.get("id")) for user in source["usuarios"] if isinstance(user, dict)}
    candidate = base
    number = 2
    while candidate in used:
        candidate = f"{base}-{number}"
        number += 1
    return candidate


def generate_unique_username(base: str, store: dict[str, Any], ignore_id: str | None = None) -> str:
    root = normalize_username(base) or "usuario"
    used = {
        normalize_username(user.get("usuario"))
        for user in store["usuarios"]
        if isinstance(user, dict) and str(user.get("id")) != str(ignore_id or "")
    }
    candidate = root
    number = 2
    while candidate in used:
        candidate = f"{root}{number}"
        number += 1
    return candidate


def find_user(user_id: str, store: dict[str, Any] | None = None) -> dict[str, Any] | None:
    source = store or read_main()
    return next(
        (
            user
            for user in source["usuarios"]
            if isinstance(user, dict) and str(user.get("id")) == str(user_id)
        ),
        None,
    )


def find_user_by_login(login: str, store: dict[str, Any] | None = None) -> dict[str, Any] | None:
    source = store or read_main()
    user_key = normalize_username(login)
    email_key = normalize_email(login)
    return next(
        (
            user
            for user in source["usuarios"]
            if isinstance(user, dict)
            and (
                normalize_username(user.get("usuario")) == user_key
                or normalize_email(user.get("email")) == email_key
            )
        ),
        None,
    )


def approved_team(store: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    source = store or read_main()
    items = [
        user
        for user in source["usuarios"]
        if isinstance(user, dict)
        and user.get("status") == "aprovado"
        and user.get("funcao") in {"Acólito", "Coroinha"}
    ]
    return sorted(items, key=lambda user: str(user.get("nome", "")).casefold())


def safe_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key not in {"senha_hash"}}


def list_scales(store: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    source = store or read_main()
    users = {str(user.get("id")): user for user in source["usuarios"] if isinstance(user, dict)}
    result: list[dict[str, Any]] = []
    for raw in source["escalas"]:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        people: list[dict[str, Any]] = []
        for raw_person in raw.get("pessoas") or []:
            if not isinstance(raw_person, dict):
                continue
            person = dict(raw_person)
            user = users.get(str(person.get("id"))) if person.get("id") else None
            if user:
                person["nome"] = user.get("nome")
                if user.get("funcao") == "Acólito":
                    person["categoria"] = "acolito"
                elif user.get("funcao") == "Coroinha":
                    person["categoria"] = "coroinha"
            people.append(person)
        item["pessoas"] = people
        result.append(item)
    return sorted(result, key=lambda scale: f"{scale.get('data','')}{scale.get('horario','')}")


def ranking_config(year: int, store: dict[str, Any] | None = None) -> dict[str, Any]:
    source = store or read_main()
    found = next(
        (
            item
            for item in source["ranking_configs"]
            if isinstance(item, dict) and int(item.get("ano") or 0) == int(year)
        ),
        None,
    )
    if found:
        return dict(found)
    return {
        "ano": int(year),
        "peso_formacao": 25,
        "peso_liturgia": 25,
        "peso_pontualidade": 30,
        "peso_reconhecimento": 20,
        "minutos_antecedencia": 30,
        "atualizado_em": 0,
    }


def _read_notifications() -> dict[str, Any]:
    value = _read_json(NOTIFICATIONS_PATH, {"notificacoes": []})
    if not isinstance(value, dict):
        value = {"notificacoes": []}
    if not isinstance(value.get("notificacoes"), list):
        value["notificacoes"] = []
    return value


def list_notifications(user_id: str, limit: int = 60) -> list[dict[str, Any]]:
    lifetime = 24 * 60 * 60 * 1000
    current = now_ms()
    with _process_lock, _file_lock(NOTIFICATIONS_PATH):
        store = _read_notifications()
        original = len(store["notificacoes"])
        store["notificacoes"] = [
            item
            for item in store["notificacoes"]
            if isinstance(item, dict)
            and isinstance(item.get("criado_em"), (int, float))
            and current - int(item["criado_em"]) < lifetime
        ]
        if len(store["notificacoes"]) != original:
            _write_json_atomic(NOTIFICATIONS_PATH, store)
        rows = [item for item in store["notificacoes"] if str(item.get("usuario_id")) == str(user_id)]
        rows.sort(key=lambda item: int(item.get("criado_em") or 0), reverse=True)
        return rows[: max(1, min(100, int(limit)))]


def save_notification(
    user_id: str,
    key: str,
    kind: str,
    title: str,
    message: str,
    href: str,
) -> dict[str, Any]:
    current = now_ms()
    lifetime = 24 * 60 * 60 * 1000
    with _process_lock, _file_lock(NOTIFICATIONS_PATH):
        store = _read_notifications()
        store["notificacoes"] = [
            item
            for item in store["notificacoes"]
            if isinstance(item, dict)
            and isinstance(item.get("criado_em"), (int, float))
            and current - int(item["criado_em"]) < lifetime
        ]
        existing = next(
            (
                item
                for item in store["notificacoes"]
                if str(item.get("usuario_id")) == str(user_id) and str(item.get("chave")) == str(key)
            ),
            None,
        )
        if existing:
            _write_json_atomic(NOTIFICATIONS_PATH, store)
            return existing
        row = {
            "id": f"notif-{current}-{os.urandom(3).hex()}",
            "usuario_id": str(user_id),
            "chave": str(key),
            "tipo": str(kind),
            "titulo": str(title).strip()[:120],
            "mensagem": str(message).strip()[:500],
            "href": href if str(href).startswith("/") else "/area-restrita/ranking",
            "criado_em": current,
            "lida_em": None,
        }
        store["notificacoes"].append(row)
        grouped: dict[str, list[dict[str, Any]]] = {}
        for item in store["notificacoes"]:
            grouped.setdefault(str(item.get("usuario_id")), []).append(item)
        store["notificacoes"] = [
            item
            for rows in grouped.values()
            for item in sorted(rows, key=lambda value: int(value.get("criado_em") or 0), reverse=True)[:250]
        ]
        _write_json_atomic(NOTIFICATIONS_PATH, store)
        return row


def mark_notification_read(user_id: str, notification_id: str) -> bool:
    with _process_lock, _file_lock(NOTIFICATIONS_PATH):
        store = _read_notifications()
        row = next(
            (
                item
                for item in store["notificacoes"]
                if str(item.get("usuario_id")) == str(user_id) and str(item.get("id")) == str(notification_id)
            ),
            None,
        )
        if not row:
            return False
        if not row.get("lida_em"):
            row["lida_em"] = now_ms()
            _write_json_atomic(NOTIFICATIONS_PATH, store)
        return True


def mark_all_notifications_read(user_id: str) -> int:
    with _process_lock, _file_lock(NOTIFICATIONS_PATH):
        store = _read_notifications()
        current = now_ms()
        changed = 0
        for row in store["notificacoes"]:
            if isinstance(row, dict) and str(row.get("usuario_id")) == str(user_id) and not row.get("lida_em"):
                row["lida_em"] = current
                changed += 1
        if changed:
            _write_json_atomic(NOTIFICATIONS_PATH, store)
        return changed


def read_aux(path: Path, fallback: Any) -> Any:
    with _process_lock:
        return _read_json(path, fallback)


def mutate_aux(path: Path, fallback: Any, mutator: Callable[[Any], T]) -> T:
    with _process_lock, _file_lock(path):
        value = _read_json(path, fallback)
        result = mutator(value)
        _write_json_atomic(path, value)
        return result
