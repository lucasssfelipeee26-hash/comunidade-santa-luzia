import "server-only"

import nodemailer from "nodemailer"

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined

/**
 * Lê a configuração SMTP das variáveis de ambiente:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *
 * Se não estiver configurado, não lança erro: registra o código no log do
 * servidor para não travar o desenvolvimento local. Configure essas
 * variáveis antes de usar em produção, ou os e-mails de recuperação de
 * senha não serão realmente enviados.
 */
function getTransporter() {
  if (transporter !== undefined) return transporter

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null
    return transporter
  }

  const port = Number(SMTP_PORT ?? 587)
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export async function enviarCodigoRecuperacao(destinatario: string, nome: string, codigo: string) {
  const t = getTransporter()
  const assunto = "Código de recuperação de senha — Comunidade Santa Luzia"
  const texto = [
    `Olá, ${nome}.`,
    "",
    `Seu código de verificação para redefinir a senha é: ${codigo}`,
    "",
    "Esse código expira em 15 minutos.",
    "Se você não solicitou essa recuperação de senha, apenas ignore este e-mail.",
  ].join("\n")

  if (!t) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[email] SMTP não configurado — não foi possível enviar o código de recuperação para ${destinatario}.`)
    } else {
      console.warn(`[email] SMTP não configurado — código de recuperação para ${destinatario} (${nome}): ${codigo}`)
    }
    return { enviado: false as const }
  }

  await t.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
    to: destinatario,
    subject: assunto,
    text: texto,
  })
  return { enviado: true as const }
}
