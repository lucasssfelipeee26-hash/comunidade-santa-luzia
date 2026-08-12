import "server-only"

import nodemailer from "nodemailer"

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined

export function emailRecuperacaoConfigurado() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  return Boolean(SMTP_HOST?.trim() && SMTP_USER?.trim() && SMTP_PASS?.trim())
}

function getTransporter() {
  if (transporter !== undefined) return transporter

  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()

  if (!host || !user || !pass) {
    transporter = null
    return transporter
  }

  const port = Number(process.env.SMTP_PORT?.trim() || 587)
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  })

  return transporter
}

export async function enviarCodigoRecuperacao(destinatario: string, nome: string, codigo: string) {
  const t = getTransporter()

  if (!t) {
    return {
      enviado: false as const,
      erro: "O envio de e-mail ainda não está configurado neste servidor.",
    }
  }

  const assunto = "Código de recuperação de senha — Comunidade Santa Luzia"
  const texto = [
    `Olá, ${nome}.`,
    "",
    "Recebemos uma solicitação para redefinir sua senha no aplicativo Santa Luzia.",
    "",
    `Seu código de verificação é: ${codigo}`,
    "",
    "O código expira em 15 minutos e só pode ser usado uma vez.",
    "Se você não solicitou a alteração, ignore esta mensagem.",
  ].join("\n")

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2b211d">
      <div style="border:1px solid #d8b45a;border-radius:14px;padding:24px;background:#fffdf8">
        <h2 style="margin:0 0 12px;color:#7f1d2d">Comunidade Santa Luzia</h2>
        <p>Olá, <strong>${escapeHtml(nome)}</strong>.</p>
        <p>Recebemos uma solicitação para redefinir sua senha no aplicativo.</p>
        <p style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:14px 22px;border-radius:10px;background:#7f1d2d;color:white;font-size:28px;font-weight:700;letter-spacing:6px">${codigo}</span>
        </p>
        <p>Este código expira em <strong>15 minutos</strong> e só pode ser usado uma vez.</p>
        <p style="font-size:13px;color:#6b625f">Se você não solicitou essa alteração, ignore este e-mail.</p>
      </div>
    </div>`

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER,
      to: destinatario,
      subject: assunto,
      text: texto,
      html,
    })
    return { enviado: true as const }
  } catch (error) {
    console.error("[email] Falha ao enviar código de recuperação:", error)
    return {
      enviado: false as const,
      erro: "Não foi possível enviar o código por e-mail. Verifique a configuração do e-mail e tente novamente.",
    }
  }
}

function escapeHtml(valor: string) {
  return valor.replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[c] || c)
}
