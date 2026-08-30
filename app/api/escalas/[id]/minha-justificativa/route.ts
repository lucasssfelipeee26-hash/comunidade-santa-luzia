import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarEscala, buscarJustificativaEscala, buscarUsuario, listarMembrosAprovados, salvarJustificativaEscala } from "@/lib/db"
import { notificarUsuarios } from "@/lib/notificacoes"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userAgent = request.headers.get("user-agent") || ""
  const windowsBeta = /SantaLuziaWindowsBeta\//.test(userAgent) || request.headers.get("x-santa-luzia-windows-beta") === "1"
  const androidNativo = /SantaLuziaNative\//.test(userAgent) || request.headers.get("x-santa-luzia-native") === "1"
  if (!windowsBeta && !androidNativo) {
    return NextResponse.json({ erro: "Recurso disponível somente nos aplicativos oficiais Santa Luzia." }, { status: 403 })
  }
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Faça login para justificar sua ausência." }, { status: 401 })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.status !== "aprovado") return NextResponse.json({ erro: "Seu perfil não está liberado." }, { status: 403 })
  const limite = limitar(`escala:justificativa:${sessao.sub}:${ipDaRequisicao(request)}`, 12, 60 * 60 * 1000)
  if (!limite.permitido) return NextResponse.json({ erro: "Aguarde antes de tentar novamente." }, { status: 429 })

  const { id } = await params
  const escala = buscarEscala(id)
  if (!escala) return NextResponse.json({ erro: "Escala não encontrada." }, { status: 404 })
  if (!escala.pessoas.some((pessoa) => pessoa.id === sessao.sub)) return NextResponse.json({ erro: "Seu perfil não está incluído nesta escala." }, { status: 403 })
  const anterior = buscarJustificativaEscala(id, sessao.sub)
  if (anterior) return NextResponse.json({ erro: "Sua falta já foi justificada e não pode mais ser alterada.", justificativa: anterior }, { status: 409 })

  const body = await request.json().catch(() => null) as { justificativa?: unknown } | null
  const justificativa = String(body?.justificativa ?? "").trim()
  if (justificativa.length < 3 || justificativa.length > 500) return NextResponse.json({ erro: "Informe o motivo da ausência, com até 500 caracteres." }, { status: 400 })
  const row = salvarJustificativaEscala(id, sessao.sub, justificativa)
  const moderadores = listarMembrosAprovados().filter((membro) => membro.tipo === "moderador").map((membro) => membro.id)
  if (moderadores.length) notificarUsuarios(moderadores, { chave: `escala-justificada:${row.id}`, tipo: "escala", titulo: "Falta justificada na escala", mensagem: `${usuario.nome} justificou a ausência de ${escala.data.split("-").reverse().join("/")} às ${escala.horario}.`, href: "/area-restrita/moderador/presencas" })
  return NextResponse.json({ ok: true, justificativa: row }, { headers: { "Cache-Control": "private, no-store, max-age=0" } })
}
