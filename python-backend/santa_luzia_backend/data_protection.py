from __future__ import annotations

import hashlib
import json
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .store import DATA_DIR, DB_PATH

BACKUP_DIR = DATA_DIR / "backups-santa-luzia"
HEALTH_PATH = DATA_DIR / "database-health.json"
MAX_BACKUPS = 8
_lock = threading.RLock()
_last_sha: str | None = None


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _valid_database(path: Path):
    if not path.exists():
        return None
    data = path.read_bytes()
    if not data:
        raise ValueError(f"Banco vazio: {path}")
    parsed = json.loads(data.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError(f"Estrutura inválida: {path}")
    for key in ("usuarios", "registros", "escalas", "formacoes", "formacao_presencas", "ranking_ajustes"):
        if key in parsed and not isinstance(parsed[key], list):
            raise ValueError(f"Campo {key} não é uma lista válida.")
    return {"data": data, "sha": _sha256(data), "size": len(data)}


def _backup_files():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    items = [item for item in BACKUP_DIR.iterdir() if item.is_file() and item.name.startswith("santa-luzia-") and item.suffix == ".json"]
    return sorted(items, key=lambda item: item.stat().st_mtime, reverse=True)


def _write_health(value: dict[str, Any]):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = HEALTH_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, HEALTH_PATH)


def _health(status: str, current: dict[str, Any] | None, *, recovered_from: str | None = None, error: str | None = None):
    backups = _backup_files()
    value = {
        "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": status,
        "databasePath": str(DB_PATH),
        "size": int(current["size"]) if current else 0,
        "sha256": current["sha"] if current else None,
        "backupCount": len(backups),
        "lastBackup": backups[0].name if backups else None,
        "recoveredFrom": recovered_from,
        "error": error,
    }
    _write_health(value)
    return value


def protect_database() -> dict[str, Any]:
    global _last_sha
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        if not DB_PATH.exists():
            for backup in _backup_files():
                try:
                    valid = _valid_database(backup)
                    if valid:
                        shutil.copyfile(backup, DB_PATH)
                        _last_sha = valid["sha"]
                        return _health("recovered", valid, recovered_from=backup.name)
                except Exception:
                    continue
            return _health("missing", None)
        try:
            current = _valid_database(DB_PATH)
            if not current:
                return _health("missing", None)
            if current["sha"] != _last_sha:
                backups = _backup_files()
                reuse = False
                if backups:
                    try:
                        latest = _valid_database(backups[0])
                        reuse = bool(latest and latest["sha"] == current["sha"])
                    except Exception:
                        reuse = False
                if not reuse:
                    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                    target = BACKUP_DIR / f"santa-luzia-{stamp}-{current['sha'][:12]}.json"
                    target.write_bytes(current["data"])
                    for old in _backup_files()[MAX_BACKUPS:]:
                        old.unlink(missing_ok=True)
                _last_sha = current["sha"]
            return _health("ok", current)
        except Exception as error:
            corrupt = DB_PATH.with_name(f"santa-luzia.json.corrompido-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
            try:
                os.replace(DB_PATH, corrupt)
            except Exception:
                pass
            for backup in _backup_files():
                try:
                    valid = _valid_database(backup)
                    if valid:
                        shutil.copyfile(backup, DB_PATH)
                        _last_sha = valid["sha"]
                        return _health("recovered", valid, recovered_from=backup.name, error=str(error))
                except Exception:
                    continue
            return _health("error", None, error=str(error))


def read_health():
    try:
        value = json.loads(HEALTH_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except Exception:
        return None
