import { NextResponse } from "next/server"
import { randomInt, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { db, type UsuarioRow } from "@/lib/db"
import { enviarCodigoRecuperacao } from "@/lib/email"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const CODIGO_VALIDADE_MS = 15 * 60 * 1000

// Funciona tanto para membros comuns quanto para moderadores: qualquer
// usuário cadastrado pode solicitar um código de recuperação por e-mail.
export async function POST(req: Request) {
  const limite = limitar("recuperacao:" + ipDaRequisicao(req), 5, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ ok: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 })
  }
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })
  }

  const email = String(body.email ?? "").trim().toLowerCase()

  // Resposta genérica sempre igual, para não revelar se o e-mail existe.
  const resposta = NextResponse.json({
    ok: true,
    mensagem: "Se este e-mail estiver cadastrado, enviaremos um código de verificação.",
  })

  if (!email) return resposta

  const usuario = db.prepare("SELECT * FROM usuarios WHERE lower(email) = ?").get(email) as
    | UsuarioRow
    | undefined

  if (!usuario) return resposta

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0")
  const codigoHash = bcrypt.hashSync(codigo, 10)

  db.prepare("DELETE FROM codigos_recuperacao WHERE usuario_id = ?").run(usuario.id)
  db.prepare(
    `INSERT INTO codigos_recuperacao (id, usuario_id, codigo_hash, expira_em, usado, criado_em)
     VALUES (?, ?, ?, ?, 0, ?)`,
  ).run(randomUUID(), usuario.id, codigoHash, Date.now() + CODIGO_VALIDADE_MS, Date.now())

  await enviarCodigoRecuperacao(usuario.email, usuario.nome, codigo)

  return resposta
}
