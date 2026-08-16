import { NextResponse } from "next/server"
import { randomInt, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { buscarUsuarioPorLogin, db } from "@/lib/db"
import { emailRecuperacaoConfigurado, enviarCodigoRecuperacao } from "@/lib/email"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const CODIGO_VALIDADE_MS = 15 * 60 * 1000
const RESPOSTA_GENERICA = "Se a conta existir e possuir e-mail de recuperação válido, enviaremos um código de 6 dígitos."

function mascararEmail(email: string) {
  const [local, dominio] = email.split("@")
  if (!local || !dominio) return "e-mail cadastrado"
  const inicio = local.slice(0, Math.min(2, local.length))
  return `${inicio}${"*".repeat(Math.max(3, local.length - inicio.length))}@${dominio}`
}

export async function POST(req: Request) {
  const limite = limitar("recuperacao:" + ipDaRequisicao(req), 5, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, erro: "Muitas solicitações. Aguarde alguns minutos antes de pedir outro código." },
      { status: 429 },
    )
  }

  let body: { email?: string; login?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })
  }

  const identificador = String(body.login ?? body.email ?? "").trim().slice(0, 254)
  if (!identificador) {
    return NextResponse.json({ ok: false, erro: "Informe seu usuário ou e-mail." }, { status: 400 })
  }

  if (!emailRecuperacaoConfigurado()) {
    return NextResponse.json(
      { ok: false, erro: "A recuperação por e-mail está temporariamente indisponível. Fale com o moderador." },
      { status: 503 },
    )
  }

  const usuario = buscarUsuarioPorLogin(identificador)

  // Não revela se o usuário/e-mail existe. Isso impede que a recuperação seja
  // usada para enumerar cadastros da comunidade.
  if (!usuario || !usuario.email?.includes("@")) {
    return NextResponse.json({ ok: true, mensagem: RESPOSTA_GENERICA })
  }

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0")
  const codigoHash = bcrypt.hashSync(codigo, 10)

  db.prepare("DELETE FROM codigos_recuperacao WHERE usuario_id = ?").run(usuario.id)
  db.prepare(
    `INSERT INTO codigos_recuperacao (id, usuario_id, codigo_hash, expira_em, usado, criado_em)
     VALUES (?, ?, ?, ?, 0, ?)`,
  ).run(randomUUID(), usuario.id, codigoHash, Date.now() + CODIGO_VALIDADE_MS, Date.now())

  const envio = await enviarCodigoRecuperacao(usuario.email, usuario.nome, codigo)
  if (!envio.enviado) {
    db.prepare("DELETE FROM codigos_recuperacao WHERE usuario_id = ?").run(usuario.id)
    return NextResponse.json(
      { ok: false, erro: "Não foi possível enviar o código agora. Tente novamente em alguns minutos." },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    mensagem: `Código enviado para ${mascararEmail(usuario.email)}. Ele expira em 15 minutos.`,
  })
}
