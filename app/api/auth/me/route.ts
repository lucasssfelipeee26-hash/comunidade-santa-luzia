import { NextResponse } from "next/server"
import { db, type UsuarioRow } from "@/lib/db"
import { lerSessao } from "@/lib/auth"

const headers = { "Cache-Control": "private, no-store, max-age=0" }

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ sessao: null }, { headers })

  const usuario = db
    .prepare("SELECT id, nome, usuario, email, tipo, funcao, desde, status FROM usuarios WHERE id = ?")
    .get(sessao.sub) as Omit<UsuarioRow, "senha_hash" | "criado_em"> | undefined

  if (!usuario) return NextResponse.json({ sessao: null }, { headers })

  const completo = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(sessao.sub) as UsuarioRow | undefined
  return NextResponse.json({
    sessao: {
      tipo: sessao.tipo,
      usuario: completo
        ? {
            id: completo.id,
            nome: completo.nome,
            usuario: completo.usuario,
            email: completo.email,
            tipo: completo.tipo,
            funcao: completo.funcao,
            desde: completo.desde,
            data_nascimento: completo.data_nascimento ?? null,
            data_votos: completo.data_votos ?? null,
            foto: completo.foto ?? null,
            status: completo.status,
          }
        : usuario,
    },
  }, { headers })
}
