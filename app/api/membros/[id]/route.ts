import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lerSessao } from "@/lib/auth"
import { montarMembro, type UsuarioRow, type RegistroRow } from "@/lib/membros"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const podeVer = sessao.tipo === "moderador" || (sessao.tipo === "membro" && sessao.sub === id)
  if (!podeVer) return NextResponse.json({ erro: "Não autorizado." }, { status: 403 })

  const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ? AND tipo = 'membro'").get(id) as UsuarioRow | undefined
  if (!usuario) return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 })

  if (sessao.tipo === "membro") {
    return NextResponse.json({ membro: montarMembro(usuario, []) }, { headers: { "Cache-Control": "no-store" } })
  }

  const registros = db.prepare("SELECT * FROM registros WHERE usuario_id = ?").all(id) as RegistroRow[]
  return NextResponse.json({ membro: montarMembro(usuario, registros) }, { headers: { "Cache-Control": "no-store" } })
}
