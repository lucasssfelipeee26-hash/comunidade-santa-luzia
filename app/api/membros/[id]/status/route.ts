import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lerSessao } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })
  }

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })
  }

  if (body.status !== "aprovado" && body.status !== "recusado") {
    return NextResponse.json({ erro: "Status inválido." }, { status: 400 })
  }

  const info = db
    .prepare("UPDATE usuarios SET status = ? WHERE id = ? AND tipo = 'membro'")
    .run(body.status, id)

  if (info.changes === 0) {
    return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
