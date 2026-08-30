from __future__ import annotations

from typing import Any

from .store import DB_PATH, mutate_main, normalize_email, normalize_username


def _username_base(user: dict[str, Any]) -> str:
    email_local = normalize_username(normalize_email(user.get("email")).split("@", 1)[0])
    name = normalize_username(user.get("nome"))
    return email_local or name or "usuario"


def migrate_legacy_users() -> bool:
    """Reproduz a migração automática e não destrutiva de lib/db.ts.

    Bancos antigos podem não ter `usuario` normalizado e moderadores legados
    podem não possuir função litúrgica. A migração TypeScript roda ao iniciar o
    processo; o backend Python faz o mesmo antes de começar a atender rotas.
    """
    if not DB_PATH.exists():
        return False

    changed = False

    def migrate(store: dict[str, Any]):
        nonlocal changed
        used: set[str] = set()
        for account in store.get("usuarios", []):
            if not isinstance(account, dict):
                continue

            candidate = normalize_username(account.get("usuario"))
            if not candidate or candidate in used:
                base = _username_base(account)
                candidate = base
                number = 2
                while candidate in used:
                    candidate = f"{base}{number}"
                    number += 1
                account["usuario"] = candidate
                changed = True
            elif account.get("usuario") != candidate:
                account["usuario"] = candidate
                changed = True
            used.add(candidate)

            if account.get("tipo") == "moderador" and account.get("funcao") not in {"Acólito", "Coroinha"}:
                account["funcao"] = "Acólito"
                account["status"] = "aprovado"
                changed = True

        return changed

    migrate_result = migrate
    # mutate_main garante lock interprocesso e escrita atômica. O arquivo já
    # existe neste ponto, então a chamada preserva o mesmo momento de migração
    # do backend legado: uma vez por inicialização do processo.
    mutate_main(migrate_result)
    return changed
