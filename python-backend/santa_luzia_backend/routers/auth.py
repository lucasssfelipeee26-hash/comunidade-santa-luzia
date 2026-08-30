from __future__ import annotations

import os
import re
import secrets
import uuid
from datetime import date
from typing import Any

import bcrypt
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from ..emailer import recovery_email_configured, send_recovery_code
from ..security import clear_session, current_user, issue_session, password_hash, password_matches
from ..store import (
    find_user,
    find_user_by_login,
    generate_user_id,
    mutate_main,
    normalize_email,
    normalize_username,
    now_ms,
    read_main,
)
from ..utils import rate_allowed, request_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
USER_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,29}$")
GENERIC_RECOVERY = "Se a conta existir e possuir e-mail de recuperação válido, enviaremos um código de 6 dígitos."


def _json(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(body, status_code=status, headers=headers)


def _body_ip(request: Request) -> str:
    return request_ip(request.headers, request.client.host if request.client else None)


def _initial_admin() -> dict[str, str] | None:
    username = normalize_username(os.getenv("INITIAL_ADMIN_USERNAME"))
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "")
    if not username or len(password) < 10:
        return None
    name = os.getenv("INITIAL_ADMIN_NAME", "Moderador").strip() or "Moderador"
    email = normalize_email(os.getenv("INITIAL_ADMIN_EMAIL")) or f"{username}@moderador.santa-luzia.invalid"
    return {"nome": name, "usuario": username, "email": email, "senha": password}


def _admin_credential(login: str, password: str) -> dict[str, str] | None:
    admin = _initial_admin()
    if not admin or password != admin["senha"]:
        return None
    key = normalize_email(login)
    return admin if key in {normalize_email(admin["usuario"]), normalize_email(admin["email"])} else None


@router.post("/login")
async def login(request: Request):
    if not rate_allowed(f"login:{_body_ip(request)}", 12, 15 * 60):
        return _json({"ok": False, "erro": "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente."}, 429)
    try:
        body = await request.json()
    except Exception:
        return _json({"ok": False, "erro": "Requisição inválida."}, 400)
    if not isinstance(body, dict):
        return _json({"ok": False, "erro": "Requisição inválida."}, 400)
    identifier = str(body.get("usuario") or body.get("email") or "").strip()
    password = str(body.get("senha") or "")
    if not identifier or not password:
        return _json({"ok": False, "erro": "Informe seu usuário/e-mail e sua senha."}, 400)

    admin = _admin_credential(identifier, password)

    def resolve(store: dict[str, Any]):
        account = find_user_by_login(identifier, store)
        if account is None and admin:
            account = next(
                (u for u in store["usuarios"] if isinstance(u, dict) and normalize_email(u.get("email")) == admin["email"]),
                None,
            )
        if account is None and admin:
            account = {
                "id": generate_user_id(admin["nome"], store),
                "nome": admin["nome"],
                "usuario": admin["usuario"],
                "email": admin["email"],
                "senha_hash": password_hash(admin["senha"]),
                "tipo": "moderador",
                "funcao": "Acólito",
                "desde": None,
                "status": "aprovado",
                "criado_em": now_ms(),
            }
            store["usuarios"].append(account)
        if account and account.get("tipo") == "moderador" and admin and not password_matches(password, str(account.get("senha_hash") or "")):
            account["senha_hash"] = password_hash(admin["senha"])
        return dict(account) if account else None

    account = mutate_main(resolve)
    if not account or not password_matches(password, str(account.get("senha_hash") or "")):
        return _json({"ok": False, "erro": "Usuário/e-mail ou senha inválidos. Confira os dados ou use ‘Esqueci minha senha’."}, 401)
    if account.get("tipo") == "membro" and account.get("status") == "pendente":
        return _json({"ok": False, "erro": "Seu cadastro aguarda aprovação do moderador."}, 403)
    if account.get("tipo") == "membro" and account.get("status") == "recusado":
        return _json({"ok": False, "erro": "Seu acesso não foi liberado. Fale com o moderador."}, 403)

    response = _json(
        {
            "ok": True,
            "destino": "/area-restrita/moderador" if account.get("tipo") == "moderador" else "/area-restrita/membro",
            "usuario": {
                "id": account.get("id"),
                "nome": account.get("nome"),
                "usuario": account.get("usuario"),
                "email": account.get("email"),
                "tipo": account.get("tipo"),
                "funcao": account.get("funcao"),
            },
        }
    )
    issue_session(response, account)
    return response


@router.post("/logout")
async def logout():
    response = _json({"ok": True})
    clear_session(response)
    return response


@router.get("/me")
async def me(request: Request):
    headers = {"Cache-Control": "private, no-store, max-age=0"}
    user = current_user(request)
    if not user:
        return _json({"sessao": None}, headers=headers)
    payload = {
        key: user.get(key)
        for key in (
            "id", "nome", "usuario", "email", "tipo", "funcao", "desde",
            "data_nascimento", "data_votos", "foto", "status",
        )
    }
    return _json({"sessao": {"tipo": user.get("tipo"), "usuario": payload}}, headers=headers)


def _valid_civil_date(value: str) -> bool:
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return False
    return 1900 <= parsed.year <= date.today().year and parsed <= date.today()


@router.post("/cadastro")
async def register(request: Request):
    if not rate_allowed(f"cadastro:{_body_ip(request)}", 5, 60 * 60):
        return _json({"ok": False, "erro": "Muitas tentativas. Aguarde alguns minutos e tente novamente."}, 429)
    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict):
        return _json({"ok": False, "erro": "Requisição inválida."}, 400)

    name = re.sub(r"\s+", " ", str(body.get("nome") or "").strip())
    username = normalize_username(body.get("usuario"))
    email = normalize_email(body.get("email"))
    password = str(body.get("senha") or "")
    function = str(body.get("funcao") or "").strip()
    birth = str(body.get("dataNascimento") or "").strip()
    vows = str(body.get("dataVotos") or "").strip() or None

    if function not in {"Acólito", "Coroinha"}:
        return _json({"ok": False, "erro": "Selecione uma função válida: Acólito ou Coroinha."}, 400)
    if not all((name, username, email, password, birth)):
        return _json({"ok": False, "erro": "Preencha nome, usuário, data de nascimento, e-mail de recuperação e senha."}, 400)
    if len(name) < 2 or len(name) > 100:
        return _json({"ok": False, "erro": "Informe um nome válido com até 100 caracteres."}, 400)
    if not USER_RE.fullmatch(username):
        return _json({"ok": False, "erro": "O usuário deve ter de 3 a 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado."}, 400)
    if len(email) > 254 or not EMAIL_RE.fullmatch(email):
        return _json({"ok": False, "erro": "E-mail de recuperação inválido."}, 400)
    if not 8 <= len(password) <= 128:
        return _json({"ok": False, "erro": "A senha deve ter entre 8 e 128 caracteres."}, 400)
    if not _valid_civil_date(birth):
        return _json({"ok": False, "erro": "Informe uma data de nascimento válida."}, 400)
    if vows and not _valid_civil_date(vows):
        return _json({"ok": False, "erro": "Informe uma data de votos válida."}, 400)
    if vows and vows < birth:
        return _json({"ok": False, "erro": "A data de votos não pode ser anterior à data de nascimento."}, 400)

    def create(store: dict[str, Any]):
        if any(normalize_username(u.get("usuario")) == username for u in store["usuarios"] if isinstance(u, dict)):
            return "username"
        if any(normalize_email(u.get("email")) == email for u in store["usuarios"] if isinstance(u, dict)):
            return "email"
        store["usuarios"].append(
            {
                "id": generate_user_id(name, store),
                "nome": name,
                "usuario": username,
                "email": email,
                "senha_hash": password_hash(password),
                "tipo": "membro",
                "funcao": function,
                "desde": vows,
                "data_nascimento": birth,
                "data_votos": vows,
                "foto": None,
                "status": "pendente",
                "criado_em": now_ms(),
            }
        )
        return "ok"

    result = mutate_main(create)
    if result == "username":
        return _json({"ok": False, "erro": "Este nome de usuário já está em uso. Escolha outro."}, 409)
    if result == "email":
        return _json({"ok": False, "erro": "Este e-mail já está vinculado a uma conta."}, 409)
    return _json({"ok": True})


def _masked_email(email: str) -> str:
    if "@" not in email:
        return "e-mail cadastrado"
    local, domain = email.split("@", 1)
    start = local[: min(2, len(local))]
    return f"{start}{'*' * max(3, len(local) - len(start))}@{domain}"


@router.post("/recuperar-senha/solicitar")
async def request_recovery(request: Request):
    if not rate_allowed(f"recuperacao:{_body_ip(request)}", 5, 15 * 60):
        return _json({"ok": False, "erro": "Muitas solicitações. Aguarde alguns minutos antes de pedir outro código."}, 429)
    try:
        body = await request.json()
    except Exception:
        return _json({"ok": False, "erro": "Requisição inválida."}, 400)
    identifier = str((body or {}).get("login") or (body or {}).get("email") or "").strip()[:254]
    if not identifier:
        return _json({"ok": False, "erro": "Informe seu usuário ou e-mail."}, 400)
    if not recovery_email_configured():
        return _json({"ok": False, "erro": "A recuperação por e-mail está temporariamente indisponível. Fale com o moderador."}, 503)
    account = find_user_by_login(identifier, read_main())
    if not account or "@" not in str(account.get("email") or ""):
        return _json({"ok": True, "mensagem": GENERIC_RECOVERY})
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = bcrypt.hashpw(code.encode(), bcrypt.gensalt(rounds=10)).decode()
    current = now_ms()

    def save_code(store: dict[str, Any]):
        store["codigos_recuperacao"] = [row for row in store["codigos_recuperacao"] if str(row.get("usuario_id")) != str(account["id"])]
        store["codigos_recuperacao"].append(
            {
                "id": str(uuid.uuid4()),
                "usuario_id": account["id"],
                "codigo_hash": code_hash,
                "expira_em": current + 15 * 60 * 1000,
                "usado": 0,
                "criado_em": current,
            }
        )

    mutate_main(save_code)
    if not send_recovery_code(str(account["email"]), str(account.get("nome") or ""), code):
        mutate_main(lambda store: store.__setitem__("codigos_recuperacao", [row for row in store["codigos_recuperacao"] if str(row.get("usuario_id")) != str(account["id"]) ]))
        return _json({"ok": False, "erro": "Não foi possível enviar o código agora. Tente novamente em alguns minutos."}, 502)
    return _json({"ok": True, "mensagem": f"Código enviado para {_masked_email(str(account['email']))}. Ele expira em 15 minutos."})


@router.post("/recuperar-senha/confirmar")
async def confirm_recovery(request: Request):
    if not rate_allowed(f"confirmar-recuperacao:{_body_ip(request)}", 10, 15 * 60):
        return _json({"ok": False, "erro": "Muitas tentativas de código. Solicite um novo código em alguns minutos."}, 429)
    try:
        body = await request.json()
    except Exception:
        return _json({"ok": False, "erro": "Requisição inválida."}, 400)
    identifier = str((body or {}).get("login") or (body or {}).get("email") or "").strip()[:254]
    code = re.sub(r"\D", "", str((body or {}).get("codigo") or ""))[:6]
    new_password = str((body or {}).get("novaSenha") or "")
    if not identifier or len(code) != 6 or not new_password:
        return _json({"ok": False, "erro": "Preencha o código de 6 dígitos e a nova senha."}, 400)
    if not 8 <= len(new_password) <= 128:
        return _json({"ok": False, "erro": "A nova senha deve ter entre 8 e 128 caracteres."}, 400)
    generic = {"ok": False, "erro": "Código inválido ou expirado. Solicite um novo código."}

    store = read_main()
    account = find_user_by_login(identifier, store)
    if not account:
        return _json(generic, 400)
    codes = [
        row for row in store["codigos_recuperacao"]
        if isinstance(row, dict) and str(row.get("usuario_id")) == str(account["id"]) and int(row.get("usado") or 0) == 0
    ]
    codes.sort(key=lambda row: int(row.get("criado_em") or 0), reverse=True)
    record = codes[0] if codes else None
    if not record or int(record.get("expira_em") or 0) < now_ms():
        if record:
            mutate_main(lambda data: next((row.__setitem__("usado", 1) for row in data["codigos_recuperacao"] if str(row.get("id")) == str(record.get("id"))), None))
        return _json(generic, 400)
    try:
        valid = bcrypt.checkpw(code.encode(), str(record.get("codigo_hash") or "").encode())
    except Exception:
        valid = False
    if not valid:
        return _json(generic, 400)

    def update(store_data: dict[str, Any]):
        target = find_user(str(account["id"]), store_data)
        if not target:
            return False
        target["senha_hash"] = password_hash(new_password)
        for row in store_data["codigos_recuperacao"]:
            if isinstance(row, dict) and str(row.get("id")) == str(record.get("id")):
                row["usado"] = 1
        return True

    if not mutate_main(update):
        return _json({"ok": False, "erro": "Não foi possível atualizar a senha. Tente novamente."}, 500)
    return _json({"ok": True, "mensagem": "Senha alterada com sucesso. Sessões recentes dessa conta serão invalidadas."})
