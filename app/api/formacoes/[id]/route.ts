import { NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { lerSessao } from "@/lib/auth"
import { atualizarFormacao, excluirFormacao, DATA_DIR } from "@/lib/db"

export const runtime = "nodejs"
const UPLOAD_DIR = path.join(DATA_DIR, "formacoes")

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  const { id } = await params
  if (!id || id.length > 160) return NextResponse.json({ erro: "Formação inválida." }, { status: 400 })

  const body = await request.json().catch(() => null) as { status?: unknown; motivo_cancelamento?: unknown } | null
  if (!body) return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })
  if (body.status !== "agendada" && body.status !== "cancelada") {
    return NextResponse.json({ erro: "Status da formação inválido." }, { status: 400 })
  }

  const status = body.status
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

  const row = excluirFormacao(id)
  if (!row) return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  if (row.arquivo) {
    const filePath = path.join(UPLOAD_DIR, path.basename(row.arquivo.nome_armazenado))
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch (error) { console.error("[Formações] Não foi possível remover o material excluído.", error) }
  }
  return NextResponse.json({ ok: true })
}
