#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SYNC = ROOT / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/core/sync/SyncWorker.kt"
DB = ROOT / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/core/data/NativeDatabase.kt"
REPO = ROOT / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/core/data/SantaLuziaRepository.kt"
SESSION = ROOT / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/core/session/SessionStore.kt"
AUTH_ME = ROOT / "app/api/auth/me/route.ts"

for path in (SYNC, DB, REPO, SESSION, AUTH_ME):
    if not path.is_file():
        raise SystemExit(f"ERRO: arquivo obrigatório ausente: {path.relative_to(ROOT)}")

sync = SYNC.read_text(encoding="utf-8")
db = DB.read_text(encoding="utf-8")
repo = REPO.read_text(encoding="utf-8")
session = SESSION.read_text(encoding="utf-8")
auth_me = AUTH_ME.read_text(encoding="utf-8")

checks = {
    "sessão persistente em DataStore": "preferencesDataStore(name = \"santa_luzia_session\")" in session,
    "worker valida a sessão na fonte autoritativa": 'request("GET", "/api/auth/me"' in sync,
    "sessao:null revoga autenticação local": 'optJSONObject("sessao")' in sync and '"server-session-null"' in sync,
    "membro não aprovado perde a sessão": 'serverStatus != "aprovado"' in sync and '"member-status-$serverStatus"' in sync,
    "mudança de identidade não troca a conta silenciosamente": 'serverUserId != local.userId' in sync and '"identity-mismatch"' in sync,
    "403 de ação isolada preserva sessão": 'response.status == 403' in sync and 'sync-forbidden' in sync,
    "fila é reproduzida somente para o dono": 'pendingMutationsForOwner(active.userId' in sync,
    "schema guarda owner_user_id": 'owner_user_id TEXT NOT NULL' in db,
    "migração v1->v2 é explícita": 'ALTER TABLE mutation_queue ADD COLUMN owner_user_id TEXT' in db and 'DATABASE_VERSION = 2' in db,
    "fila antiga sem dono fica em quarentena": 'quarantinedMutationCount' in db and 'sync-quarantined-legacy-queue' in sync,
    "novas filas exigem usuário proprietário": 'require(ownerUserId.isNotBlank())' in db,
    "repositório vincula enqueue à sessão atual": 'enqueueForCurrentUser' in repo and 'database.enqueue(ownerUserId, method, path, payload)' in repo,
    "endpoint auth/me expõe status atual": 'status: completo.status' in auth_me,
    "endpoint auth/me representa sessão expirada com null": '{ sessao: null }' in auth_me,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(("OK  " if ok else "FAIL") + name)

if failed:
    raise SystemExit("ERRO: auditoria de sessão/fila falhou: " + "; ".join(failed))

# Regra negativa simples: no bloco dedicado a 403, não pode haver clear() antes do próximo caso.
forbidden_start = sync.find("response.status == 403")
next_case = sync.find("response.status in 400..499", forbidden_start)
if forbidden_start < 0 or next_case < 0:
    raise SystemExit("ERRO: não foi possível localizar o tratamento de HTTP 403.")
if "sessionStore.clear()" in sync[forbidden_start:next_case]:
    raise SystemExit("ERRO: HTTP 403 isolado está encerrando a sessão inteira.")

print("Auditoria de sessão e fila offline concluída com sucesso.")
