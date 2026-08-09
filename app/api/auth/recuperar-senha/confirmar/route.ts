import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db, type UsuarioRow } from "@/lib/db"
import { hashSenha } from "@/lib/auth"

type CodigoRow = {
  id: string
  usuario_id: string
  codigo_hash: string
  expira_em: number
  usado: number
  criado_em: number
}

export async function POST(req: Request) {
  let body: { email?: string; codigo?: string; novaSenha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  const codigo = String(body.codigo ?? "").trim()
  const novaSenha = String(body.novaSenha ?? "")

  if (!email || !codigo || !novaSenha) {
    return NextResponse.json({ ok: false, erro: "Preencha todos os campos." }, { status: 400 })
  }

  if (novaSenha.length < 6) {
    return NextResponse.json({ ok: false, erro: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 })
  }

  const usuario = db.prepare("SELECT * FROM usuarios WHERE lower(email) = ?").get(email) as
    | UsuarioRow
    | undefined

  const generico = NextResponse.json({ ok: false, erro: "Código inválido ou expirado." }, { status: 400 })

  if (!usuario) return generico

  const registro = db
    .prepare(
      "SELECT * FROM codigos_recuperacao WHERE usuario_id = ? AND usado = 0 ORDER BY criado_em DESC LIMIT 1",
    )
    .get(usuario.id) as CodigoRow | undefined

  if (!registro || registro.expira_em < Date.now()) return generico
  if (!bcrypt.compareSync(codigo, registro.codigo_hash)) return generico

  db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(novaSenha), usuario.id)
  db.prepare("UPDATE codigos_recuperacao SET usado = 1 WHERE id = ?").run(registro.id)

  return NextResponse.json({ ok: true })
}
