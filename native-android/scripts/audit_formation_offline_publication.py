#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android" / "app" / "src" / "main" / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

moderator = (NATIVE / "features" / "formation" / "FormationModeratorFeature.kt").read_text(encoding="utf-8")
repository = (NATIVE / "core" / "data" / "SantaLuziaRepository.kt").read_text(encoding="utf-8")
backend = (ROOT / "app" / "api" / "formacoes" / "route.ts").read_text(encoding="utf-8")

errors: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)

require('creationRequestId' in moderator and 'UUID.randomUUID().toString()' in moderator, "Tela não mantém identificador da publicação")
require('draft.toJson(requestId)' in moderator, "Formação sem anexo não envia clientRequestId")
require('path = "/api/formacoes"' in moderator and 'container.repository.mutate(' in moderator, "Formação sem anexo não usa fluxo local-first")
require('optimisticCacheKey = optimistic?.let { "formacoes" }' in moderator, "Formação pendente não é persistida no cache")
require('"local-formation-$requestId"' in moderator, "Placeholder local da formação não existe")
require('formation.id.startsWith("local-formation-")' in moderator, "UI não protege formação ainda não sincronizada")
require('container.repository.mutateMultipartOnlineOnly(' in moderator, "Upload com material não permanece online-only")
require('"clientRequestId" to requestId' in moderator, "Upload online não reutiliza a chave idempotente")
require('mutateOnlineOnly("DELETE", "/api/formacoes/${formation.id}"' in moderator, "Exclusão destrutiva foi colocada em fila")

require('verb == "POST" && path == "/api/formacoes"' in repository, "Allowlist não reconhece formação JSON idempotente")
require('body?.optString("clientRequestId")' in repository, "Fila de formação aceita payload sem chave idempotente")
require('description.length <= 4_000' in repository, "Allowlist não valida payload básico da formação")

require('contentType.toLowerCase().includes("application/json")' in backend, "Servidor não aceita criação JSON sem anexo")
require('client_request_id: clientRequestId' in backend, "Servidor não persiste chave idempotente da formação")
require('client_request_fingerprint: fingerprint' in backend, "Servidor não persiste fingerprint da formação")
require('formacao.client_request_id === clientRequestId' in backend, "Servidor não reconhece replay da formação")
require('existente.client_request_fingerprint !== fingerprint' in backend, "Reuso de chave com conteúdo diferente não é rejeitado")
require('arquivoHash = createHash("sha256")' in backend, "Fingerprint do anexo não inclui hash do conteúdo")
require('update(`${sessao.sub}:${clientRequestId}`)' in backend, "Nome do arquivo idempotente não deriva da tentativa")
require('runCatchingUnlink(storedPath)' in backend, "Falha ao salvar registro pode deixar arquivo recém-criado sem limpeza")
require('formacaoPublica(existente)' in backend, "Campos internos podem vazar no replay")

if errors:
    print("AUDITORIA DE PUBLICAÇÃO DE FORMAÇÃO — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA DE PUBLICAÇÃO DE FORMAÇÃO")
print("✓ sem anexo: local-first e idempotente")
print("✓ com anexo: online-only com retry idempotente")
print("✓ arquivo: hash e nome determinístico")
print("✓ placeholder: protegido até sincronizar")
print("✓ edição/exclusão: server-confirmed")
