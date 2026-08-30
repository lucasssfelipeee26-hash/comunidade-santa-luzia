#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android" / "app" / "src" / "main" / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

moderator = (NATIVE / "features" / "scale" / "ScaleModeratorFeature.kt").read_text(encoding="utf-8")
repository = (NATIVE / "core" / "data" / "SantaLuziaRepository.kt").read_text(encoding="utf-8")
backend = (ROOT / "app" / "api" / "escalas" / "route.ts").read_text(encoding="utf-8")

errors: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)

require('UUID.randomUUID().toString()' in moderator, "Publicação nativa não gera clientRequestId único")
require('.put("clientRequestId", requestId)' in moderator, "clientRequestId não é enviado ao servidor")
require('container.repository.mutate(' in moderator and 'path = "/api/escalas"' in moderator, "Nova escala ainda não usa mutação local-first")
require('optimisticCacheKey = optimistic?.let { "escalas" }' in moderator, "Nova escala offline não atualiza cache local")
require('"local-scale-$requestId"' in moderator, "Placeholder local da escala pendente não existe")
require('scale.id.startsWith("local-scale-")' in moderator, "UI não identifica escala aguardando sincronização")
require('"Aguardando sincronização"' in moderator, "UI não informa publicação pendente")
require('mutateOnlineOnly("PATCH", "/api/escalas/${current.id}"' in moderator, "Edição concorrente foi colocada indevidamente em fila")
require('mutateOnlineOnly("DELETE", "/api/escalas/${scale.id}"' in moderator, "Exclusão destrutiva foi colocada indevidamente em fila")

require('verb == "POST" && path == "/api/escalas"' in repository, "Allowlist não reconhece publicação idempotente de escala")
require('body?.optString("clientRequestId")' in repository, "Fila aceita publicação sem clientRequestId")
require('Regex("^[A-Za-z0-9._:-]{8,120}$")' in repository, "Fila não valida clientRequestId de escala")

require('client_request_id: clientRequestId' in backend, "Servidor não persiste chave idempotente junto da escala")
require('client_request_fingerprint: fingerprint' in backend, "Servidor não persiste fingerprint da publicação")
require('criado_por: sessao.sub' in backend, "Chave idempotente não é vinculada ao moderador")
require('escala.client_request_id === clientRequestId' in backend, "Servidor não procura replay da mesma publicação")
require('existente.client_request_fingerprint !== fingerprint' in backend, "Servidor não rejeita reutilização da chave com conteúdo diferente")
require('duplicado: true' in backend, "Replay idempotente não retorna confirmação explícita")
require('escalaPublica(existente)' in backend, "Campos internos de idempotência podem vazar no replay")

if errors:
    print("AUDITORIA DE PUBLICAÇÃO OFFLINE DE ESCALA — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA DE PUBLICAÇÃO OFFLINE DE ESCALA")
print("✓ criação: local-first com clientRequestId")
print("✓ replay: idempotente no mesmo registro persistente")
print("✓ placeholder: visível e não editável antes da sincronização")
print("✓ edição/exclusão: permanecem server-confirmed")
