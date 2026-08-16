import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { lerSessao } from "@/lib/auth"
import { dataCivilIsoValida } from "@/lib/validation"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const TIPOS_VALIDOS = ["advertencias", "justificativas", "faltas", "observacoes"] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  if (!id || id.length > 160) return NextResponse.json({ erro: "Perfil inválido." }, { status: 400 })

  const limite = limitar(`registro:${sessao.sub}:${ipDaRequisicao(req)}`, sessao.tipo === "moderador" ? 80 : 12, 60 * 60 * 1000)
  if (!limite.permitido) return NextResponse.json({ erro: "Muitos registros enviados em pouco tempo. Aguarde antes de tentar novamente." }, { status: 429 })

  const body = await req.json().catch(() => null) as { tipo?: unknown; data?: unknown; descricao?: unknown } | null
  if (!body) return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })

  const tipo = String(body.tipo || "")
  const data = String(body.data || "").trim()
  const descricao = String(body.descricao || "").trim()
  if (!(TIPOS_VALIDOS as readonly string[]).includes(tipo) || !dataCivilIsoValida(data, { anoMinimo: 2020, anoMaximo: 2100 }) || descricao.length < 3 || descricao.length > 2_000) {
    return NextResponse.json({ erro: "Informe tipo, data e descrição válidos. A descrição pode ter até 2.000 caracteres." }, { status: 400 })
  }

  const podeComoMembro = tipo === "justificativas" && sessao.tipo === "membro" && sessao.sub === id
  const podeComoModerador = sessao.tipo === "moderador"
  if (!podeComoMembro && !podeComoModerador) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })
  }

  const membro = db.prepare("SELECT 1 FROM usuarios WHERE id = ? AND tipo = 'membro'").get(id)
  if (!membro) return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 })

  db.prepare(
    "INSERT INTO registros (id, usuario_id, tipo, data, descricao, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), id, tipo, data, descricao, Date.now())

  return NextResponse.json({ ok: true })
}
