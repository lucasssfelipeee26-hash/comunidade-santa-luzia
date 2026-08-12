import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { buscarUsuarioPorLogin, db } from "@/lib/db"
import { hashSenha } from "@/lib/auth"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

type CodigoRow = {
  id: string
  usuario_id: string
  codigo_hash: string
  expira_em: number
  usado: number
  criado_em: number
}

export async function POST(req: Request) {
  const limite = limitar("confirmar-recuperacao:" + ipDaRequisicao(req), 10, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, erro: "Muitas tentativas de código. Solicite um novo código em alguns minutos." },
      { status: 429 },
    )
  }

  let body: { email?: string; login?: string; codigo?: string; novaSenha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })
  }

  const identificador = String(body.login ?? body.email ?? "").trim()
  const codigo = String(body.codigo ?? "").replace(/\D/g, "").slice(0, 6)
  const novaSenha = String(body.novaSenha ?? "")

  if (!identificador || codigo.length !== 6 || !novaSenha) {
    return NextResponse.json({ ok: false, erro: "Preencha o código de 6 dígitos e a nova senha." }, { status: 400 })
  }

  if (novaSenha.length < 8) {
    return NextResponse.json({ ok: false, erro: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 })
  }

  const usuario = buscarUsuarioPorLogin(identificador)
  const generico = NextResponse.json({ ok: false, erro: "Código inválido ou expirado. Solicite um novo código." }, { status: 400 })
  if (!usuario) return generico

  const registro = db
    .prepare("SELECT * FROM codigos_recuperacao WHERE usuario_id = ? AND usado = 0 ORDER BY criado_em DESC LIMIT 1")
    .get(usuario.id) as CodigoRow | undefined

  if (!registro || registro.expira_em < Date.now()) return generico
  if (!bcrypt.compareSync(codigo, registro.codigo_hash)) return generico

  const atualizou = db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(novaSenha), usuario.id)
  if (!atualizou.changes) {
    return NextResponse.json({ ok: false, erro: "Não foi possível atualizar a senha. Tente novamente." }, { status: 500 })
  }

  db.prepare("UPDATE codigos_recuperacao SET usado = 1 WHERE id = ?").run(registro.id)
  return NextResponse.json({ ok: true, mensagem: "Senha alterada com sucesso." })
}
