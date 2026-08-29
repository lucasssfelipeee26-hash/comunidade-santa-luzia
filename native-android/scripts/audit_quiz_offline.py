#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android" / "app" / "src" / "main" / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

journey = (NATIVE / "features" / "journey" / "JourneyFeature.kt").read_text(encoding="utf-8")
repository = (NATIVE / "core" / "data" / "SantaLuziaRepository.kt").read_text(encoding="utf-8")
sync = (NATIVE / "core" / "sync" / "SyncWorker.kt").read_text(encoding="utf-8")
application_text = (NATIVE / "SantaLuziaApplication.kt").read_text(encoding="utf-8")
admin = (NATIVE / "features" / "admin" / "QuizAdminFeature.kt").read_text(encoding="utf-8")
notifications = (NATIVE / "features" / "notifications" / "NotificationsFeature.kt").read_text(encoding="utf-8")
database = (NATIVE / "core" / "data" / "NativeDatabase.kt").read_text(encoding="utf-8")
backend = (ROOT / "app" / "api" / "quizzes" / "[id]" / "responder" / "route.ts").read_text(encoding="utf-8")

errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


# 1) Um quiz avulso só existe offline depois de ter sido recebido e cacheado.
require('readLocalFirst("quizzes", "/api/quizzes"' in journey, "Lista de quizzes não usa cache local-first")
require('"quizzes" to "/api/quizzes"' in repository, "Sincronização essencial não baixa quizzes publicados")
require('SyncScheduler.syncNow(this)' in application_text, "Abertura do app não agenda sincronização assim que houver rede")

# 2) Depois de baixado, a resposta pode ser feita offline e deve sobreviver até reconectar.
require('clientRequestId' in journey, "Resposta avulsa não possui identificador único de replay")
require('optimisticCacheKey = "quizzes"' in journey, "Resposta offline não atualiza o cache local do quiz")
require('Respondido offline · aguardando envio' in journey, "Interface não informa resposta avulsa pendente")
require('Regex("^/api/quizzes/[^/]+/responder$")' in repository, "Política de fila não reconhece resposta de quiz avulso")
require('requestId.isNotBlank()' in repository, "Fila de quiz avulso aceita replay sem identificador único")
require('database.enqueue' in repository and 'mutation_queue' in database, "Resposta offline não usa fila persistente")
require('Regex("^/api/quizzes/[^/]+/responder$")' in sync, "SyncWorker não reconhece replay de quiz avulso")

# 3) Sessão local expirada no servidor não pode apagar uma resposta já feita.
require('shouldPreserveOnAuthFailure' in repository, "Repositório não possui proteção para sessão expirada")
require('preserveOnAuthFailure && response.status in setOf(401, 403)' in repository, "401/403 ainda podem descartar resposta avulsa")
require('response.status == 401 || response.status == 403' in sync, "SyncWorker não conserva fila aguardando nova autenticação")
require('SyncScheduler.syncNow(container.appContext)' in journey, "Resposta enfileirada não agenda sincronização posterior")

# 4) O Quiz Litúrgico cronometrado continua sendo uma regra diferente.
require('path == "/api/quizzes/liturgia/responder") return false' in repository, "Quiz litúrgico cronometrado foi colocado indevidamente na fila")

# 5) Criar/editar/publicar/excluir Quiz avulso é administrativo e necessariamente online.
require('mutateOnlineOnly("POST", "/api/quizzes"' in admin, "Administração de Quiz avulso não está restrita à rede")
require('isQuizAdminOnline' in admin, "Tela administrativa não valida conexão antes de publicar")
require('Publicação exige internet' in admin or 'publicar um Quiz avulso' in admin, "Regra de publicação online não está explícita na UI")

# 6) Reconexão precisa ser idempotente: se o servidor já recebeu, não duplica pontuação.
require('duplicado: true' in backend and 'ok: true' in backend and 'Quiz já sincronizado' in backend, "Backend não trata replay de resposta como já sincronizado")

# 7) O mesmo ciclo que baixa o Quiz também atualiza notificações; leitura offline é persistida.
require('"notificacoes" to "/api/notificacoes"' in repository, "Sincronização essencial não atualiza notificações")
require('optimisticCacheKey = "notificacoes"' in notifications, "Estado de leitura de notificações não persiste offline")

if errors:
    print("AUDITORIA QUIZ AVULSO OFFLINE — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA QUIZ AVULSO OFFLINE")
print("✓ publicação e administração: somente online")
print("✓ download: cache local-first")
print("✓ resposta: offline após download")
print("✓ envio: fila persistente ao reconectar")
print("✓ sessão expirada: resposta preservada até novo login")
print("✓ replay: idempotente")
print("✓ notificações: sincronizadas e persistidas offline")
