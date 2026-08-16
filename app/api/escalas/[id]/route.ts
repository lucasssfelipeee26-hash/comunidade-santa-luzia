import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { excluirEscala } from "@/lib/db"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 403 })
  }

  const { id } = await params
  if (!id || id.length > 160) {
    return NextResponse.json({ ok: false, erro: "Escala inválida." }, { status: 400 })
  }

  if (!excluirEscala(id)) {
    return NextResponse.json({ ok: false, erro: "Escala não encontrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
