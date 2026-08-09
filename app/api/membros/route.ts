import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lerSessao } from "@/lib/auth"
import { montarMembro, type UsuarioRow, type RegistroRow } from "@/lib/membros"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })
  }

  const membros = db
    .prepare("SELECT * FROM usuarios WHERE tipo = 'membro' ORDER BY criado_em DESC")
    .all() as UsuarioRow[]
  const registros = db.prepare("SELECT * FROM registros").all() as RegistroRow[]

  return NextResponse.json({
    membros: membros.map((m) => montarMembro(m, registros)),
  })
}
