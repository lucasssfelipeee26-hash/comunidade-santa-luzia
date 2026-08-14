import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { db, listarEquipeAprovada } from "@/lib/db"
import { montarMembro, type RegistroRow } from "@/lib/membros"

export const dynamic = "force-dynamic"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })
  }

  const registros = db.prepare("SELECT * FROM registros").all() as RegistroRow[]
  const equipe = listarEquipeAprovada().map((usuario) => montarMembro(usuario, registros))

  return NextResponse.json(
    { equipe },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
