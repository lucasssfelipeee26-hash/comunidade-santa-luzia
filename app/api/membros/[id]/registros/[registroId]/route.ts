import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lerSessao } from "@/lib/auth"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; registroId: string }> },
) {
  const { id, registroId } = await params
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })
  }

  db.prepare("DELETE FROM registros WHERE id = ? AND usuario_id = ?").run(registroId, id)

  return NextResponse.json({ ok: true })
}
