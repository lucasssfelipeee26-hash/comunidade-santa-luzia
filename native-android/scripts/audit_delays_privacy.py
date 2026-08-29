#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android" / "app" / "src" / "main" / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

ui = (NATIVE / "features" / "delays" / "DelaysFeature.kt").read_text(encoding="utf-8")
route = (ROOT / "app" / "api" / "ranking" / "route.ts").read_text(encoding="utf-8")

errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


# Membro pode reportar colega, mas não a si próprio.
require('state.members.filter { it.id != state.myId }' in ui, "UI permite selecionar o próprio perfil para atraso")
require('put("action", "reportar_atraso")' in ui, "UI não envia relato de atraso")
require('if (usuarioId === ctx.usuario.id)' in route, "Servidor não bloqueia autorrelato")
require('membroLiturgicoAprovado(usuarioId)' in route, "Servidor não valida o membro relatado")

# O relato precisa funcionar local-first e sobreviver sem rede.
require('clientRequestId' in ui, "Relato não possui identificador de replay")
require('container.repository.mutate("POST", "/api/ranking", payload)' in ui, "Relato não usa repositório local-first")
require('Relato salvo no aparelho. Ele será enviado quando a internet voltar.' in ui, "UI não informa persistência offline")
require('buscarPontualidadePorRequisicao' in route and 'duplicado: true' in route, "Servidor não trata replay do relato de forma idempotente")

# Privacidade: somente moderador, relatado e autor do relato recebem o detalhe individual.
privacy_block = '''ctx.usuario.tipo === "moderador" ||\n    o.usuario_id === ctx.usuario.id ||\n    o.reportado_por === ctx.usuario.id'''
require(privacy_block in route, "GET do ranking não restringe relato aos perfis envolvidos")
require('o.status === "confirmado" ||' not in route, "Relato confirmado ainda é exposto a membros não envolvidos")
require('const idsVisiveis = new Set(ocorrenciasVisiveis.map((o) => o.id))' in route, "Reações não são limitadas às ocorrências visíveis")
require('.filter((r) => idsVisiveis.has(r.ocorrencia_id))' in route, "Servidor devolve reações de relatos privados")

# Só moderador decide confirmar/rejeitar, também no servidor.
require('if (ctx.usuario.tipo !== "moderador") return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })' in route, "Servidor não protege moderação de atraso")
require('status !== "confirmado" && status !== "rejeitado"' in route, "Servidor não valida decisão de moderação")
require('isModerator && occurrence.status == "pendente"' in ui, "UI não restringe botões de moderação")

# Mesmo a reação a um atraso confirmado não pode furar a privacidade.
require('const podeVerOcorrencia = ctx.usuario.tipo === "moderador" || ocorrencia.usuario_id === ctx.usuario.id || ocorrencia.reportado_por === ctx.usuario.id' in route, "Ação de reação permite inferir/interagir com relato privado")
require('if (!podeVerOcorrencia)' in route, "Servidor não bloqueia reação de membro não envolvido")

if errors:
    print("AUDITORIA DE ATRASOS E PRIVACIDADE — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA DE ATRASOS E PRIVACIDADE")
print("✓ qualquer membro pode relatar outro membro")
print("✓ autorrelato é bloqueado no app e no servidor")
print("✓ relato offline usa fila/replay idempotente")
print("✓ detalhe individual é privado aos envolvidos e à moderação")
print("✓ apenas moderador confirma ou rejeita")
print("✓ reações não atravessam a barreira de privacidade")
