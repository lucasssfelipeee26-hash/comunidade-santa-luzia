import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { lerSessao } from "@/lib/auth"

const TIPOS_VALIDOS = ["advertencias", "justificativas", "faltas", "observacoes"] as const

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  let body: { tipo?: string; data?: string; descricao?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })
  }

  const { tipo, data, descricao } = body
  if (!tipo || !(TIPOS_VALIDOS as readonly string[]).includes(tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(data ?? "") || !descricao?.trim()) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 })
  }

  // O próprio membro só pode registrar justificativas para si mesmo;
  // advertências, faltas e observações são de uso exclusivo do moderador.
  const podeComoMembro = tipo === "justificativas" && sessao.tipo === "membro" && sessao.sub === id
  const podeComoModerador = sessao.tipo === "moderador"
  if (!podeComoMembro && !podeComoModerador) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })
  }

  const membro = db.prepare("SELECT 1 FROM usuarios WHERE id = ? AND tipo = 'membro'").get(id)
  if (!membro) return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 })

  db.prepare(
    "INSERT INTO registros (id, usuario_id, tipo, data, descricao, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), id, tipo, data, descricao.trim(), Date.now())

  return NextResponse.json({ ok: true })
}
