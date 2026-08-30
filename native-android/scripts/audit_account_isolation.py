#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp"

paths = {
    "db": NATIVE / "core/data/NativeDatabase.kt",
    "repo": NATIVE / "core/data/SantaLuziaRepository.kt",
    "sync": NATIVE / "core/sync/SyncWorker.kt",
    "notifications": NATIVE / "core/notifications/NativeNotificationDispatcher.kt",
    "jewels": NATIVE / "features/journey/JewelsGameFeature.kt",
    "whatajong": NATIVE / "features/journey/WhatajongFeature.kt",
    "journey": NATIVE / "features/journey/JourneyFeature.kt",
    "admin": NATIVE / "features/admin/AdminDataFeature.kt",
    "archive_admin": NATIVE / "features/admin/LiturgyArchiveAdminFeature.kt",
}

missing = [str(path.relative_to(ROOT)) for path in paths.values() if not path.is_file()]
if missing:
    raise SystemExit("ERRO: arquivos ausentes: " + ", ".join(missing))

text = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}
errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


# SQLite e fila offline
require("owner_user_id TEXT NOT NULL" in text["db"], "mutation_queue não exige proprietário")
require("DATABASE_VERSION = 2" in text["db"], "schema SQLite não está na versão com isolamento por usuário")
require("ALTER TABLE mutation_queue ADD COLUMN owner_user_id TEXT" in text["db"], "migração da fila antiga não está explícita")
require("userDocumentKey" in text["db"] and 'return "user:${userId.trim()}:$cacheKey"' in text["db"], "chave padrão de documento por usuário ausente")
require("pendingMutationsForOwner(active.userId" in text["sync"], "worker pode reproduzir mutações de outra conta")
require("quarantinedMutationCount" in text["sync"], "fila legada sem dono não está em quarentena")

# Repositório: dados autenticados precisam resolver a chave a partir da sessão persistida.
require("resolveCacheKey(cacheKey, authenticated)" in text["repo"], "readLocalFirst não resolve cache autenticado por conta")
require("NativeDatabase.userDocumentKey(ownerUserId, cacheKey)" in text["repo"], "repositório não usa chave de documento por usuário")
require("cachedDocumentForCurrentUser" in text["repo"], "acessos otimistas não têm API segura para cache da conta atual")
require("return false\n    }\n\n    suspend fun warmEssentialCaches" in text["repo"], "política de fila não termina em deny-by-default")

# Notificações: cache e controle de 'já exibida' precisam pertencer à conta validada.
require("deliverUnreadFromCache(ownerUserId" in text["notifications"], "despachante não recebe o dono do cache")
require('userDocumentKey(ownerUserId, "notificacoes")' in text["notifications"], "notificações ainda leem cache global")
require('"shown:$ownerUserId:$id"' in text["notifications"], "estado de notificação exibida ainda é global no aparelho")
require("deliverUnreadFromCache(active.userId)" in text["sync"], "worker não entrega notificações para o usuário validado")

# Jogos: progresso local e envio não podem atravessar contas no mesmo aparelho.
require("scopedJewelKey" in text["jewels"] and '"$base:user:$ownerUserId"' in text["jewels"], "Joias da Luz não separa progresso por usuário")
require("currentSession.userId != ownerUserId" in text["jewels"], "Joias da Luz não revalida identidade antes de enviar resultado")
require("whatajongKey(ownerUserId" in text["whatajong"], "Whatajong não separa rodada local por usuário")
require("currentSession.userId != ownerUserId" in text["whatajong"], "Whatajong não revalida identidade antes de enviar resultado")

# Quiz avulso: atualização otimista deve usar a API já escopada pela sessão atual.
require('cachedDocumentForCurrentUser("quizzes")' in text["journey"], "Quiz avulso ainda lê cache global diretamente")

# Administração: caches privilegiados nunca podem ser compartilhados entre moderadores no mesmo aparelho.
require('val cacheKey = "user:${userId.ifBlank { "unknown" }}:admin-dados"' in text["admin"], "admin-dados ainda usa cache global")
require('readLocalFirst(cacheKey, "/api/app/admin-dados", authenticated = true)' in text["admin"], "admin-dados não usa a chave isolada")
require('"user:${userId.ifBlank { "unknown" }}:admin-acervo-liturgico-status"' in text["archive_admin"], "status administrativo do acervo não está isolado por moderador")
require('readLocalFirst(key, "/api/admin/acervo-liturgico", authenticated = true)' in text["archive_admin"], "status do acervo não usa a chave isolada")
require('readLocalFirst("admin-dados"' not in text["admin"], "chave global antiga admin-dados reapareceu")

if errors:
    print("AUDITORIA DE ISOLAMENTO POR CONTA — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA DE ISOLAMENTO POR CONTA")
print("✓ fila offline pertence ao usuário que criou a alteração")
print("✓ fila legada sem dono fica em quarentena")
print("✓ caches autenticados são resolvidos por userId")
print("✓ notificações são lidas e deduplicadas por conta")
print("✓ Joias da Luz e Whatajong isolam progresso e envio por conta")
print("✓ caches administrativos são separados por moderador")
print("✓ política de fila é deny-by-default")
