import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { lerSessao } from "@/lib/auth"
import { atualizarFormacao, buscarFormacao, excluirFormacao, listarPresencasFormacao, DATA_DIR } from "@/lib/db"

export const runtime = "nodejs"
const UPLOAD_DIR = path.join(DATA_DIR, "formacoes")

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  const { id } = await params
  if (!id || id.length > 160) return NextResponse.json({ erro: "Formação inválida." }, { status: 400 })

  const atual = buscarFormacao(id)
  if (!atual) return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })

  const body = await request.json().catch(() => null) as { status?: unknown; motivo_cancelamento?: unknown; titulo?: unknown; tema?: unknown; data?: unknown; horario?: unknown; descricao?: unknown } | null
  if (!body) return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })

  const presencas = listarPresencasFormacao(id)
  const windowsBeta = request.headers.get("user-agent")?.includes("SantaLuziaWindowsBeta/") || request.headers.get("x-santa-luzia-windows-beta") === "1"
  if (windowsBeta && body.status === undefined) {
    if (atual.status === "concluida" || presencas.length > 0) {
      return NextResponse.json({ erro: "Esta formação já possui histórico e não pode ter seus dados estruturais alterados." }, { status: 409 })
    }

    const titulo = String(body.titulo || "").trim()
    const tema = String(body.tema || "").trim()
    const data = String(body.data || "").trim()
    const horario = String(body.horario || "").trim()
    if (titulo.length < 2 || titulo.length > 160 || tema.length < 2 || tema.length > 240 || !/^\d{4}-\d{2}-\d{2}$/.test(data) || (horario && !/^\d{2}:\d{2}$/.test(horario))) {
      return NextResponse.json({ erro: "Informe título, tema, data e horário válidos." }, { status: 400 })
    }
    const editada = atualizarFormacao(id, { titulo, tema, data, horario: horario || null, descricao: String(body.descricao || "").trim() })
    return editada ? NextResponse.json({ formacao: editada }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  }
  if (body.status !== "agendada" && body.status !== "concluida" && body.status !== "cancelada") {
    return NextResponse.json({ erro: "Status da formação inválido." }, { status: 400 })
  }

  const status = body.status
  if (presencas.length > 0 && status !== atual.status && status !== "concluida") {
    return NextResponse.json({ erro: "Uma formação com registros de presença não pode ser reaberta ou cancelada retroativamente." }, { status: 409 })
  }

  const motivo = String(body.motivo_cancelamento || "").trim()
  if (status === "cancelada" && (motivo.length < 3 || motivo.length > 1_000)) {
    return NextResponse.json({ erro: "Informe o motivo do cancelamento, com até 1.000 caracteres." }, { status: 400 })
  }

  const row = atualizarFormacao(id, { status, motivo_cancelamento: status === "cancelada" ? motivo : null })
  if (!row) return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  return NextResponse.json({ formacao: row }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  const { id } = await params
  if (!id || id.length > 160) return NextResponse.json({ erro: "Formação inválida." }, { status: 400 })

  const atual = buscarFormacao(id)
  if (!atual) return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  if (atual.status === "concluida" || listarPresencasFormacao(id).length > 0) {
    return NextResponse.json({ erro: "Esta formação possui histórico e não pode ser excluída. Preserve o registro para auditoria." }, { status: 409 })
  }

  const row = excluirFormacao(id)
  if (!row) return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  if (row.arquivo) {
    const filePath = path.join(UPLOAD_DIR, path.basename(row.arquivo.nome_armazenado))
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch (error) { console.error("[Formações] Não foi possível remover o material excluído.", error) }
  }
  return NextResponse.json({ ok: true })
}
