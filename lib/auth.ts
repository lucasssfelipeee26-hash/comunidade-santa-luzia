import "server-only"

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { APP_AUTH_RELEASE } from "@/lib/app-release"

const COOKIE_NAME = "santa_luzia_sessao"

// Em produção, AUTH_SECRET é obrigatório. O segredo de desenvolvimento
// existe apenas para facilitar o uso local e nunca deve ser usado no Railway.
function getSecret() {
  const valor = process.env.AUTH_SECRET?.trim()
  if (!valor && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET não configurado. Defina a variável de ambiente antes de usar a Área Restrita em produção.")
  }
  return new TextEncoder().encode(valor || "dev-somente-troque-este-segredo-em-producao-santa-luzia")
}

export type SessaoPayload = {
  sub: string
  tipo: "moderador" | "membro"
  versao: string
}

export async function criarSessao(payload: Omit<SessaoPayload, "versao">) {
  const token = await new SignJWT({ ...payload, versao: APP_AUTH_RELEASE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("400d")
    .sign(getSecret())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Mantém o acesso entre aberturas do aplicativo. A sessão também é
    // vinculada à APP_AUTH_RELEASE e deixa de ser aceita quando uma nova
    // versão do app altera essa constante.
    maxAge: 60 * 60 * 24 * 400,
  })
}

export async function lerSessao(): Promise<SessaoPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (
      typeof payload.sub !== "string" ||
      (payload.tipo !== "moderador" && payload.tipo !== "membro") ||
      payload.versao !== APP_AUTH_RELEASE
    ) {
      return null
    }
    return { sub: payload.sub, tipo: payload.tipo, versao: APP_AUTH_RELEASE }
  } catch {
    return null
  }
}

export async function encerrarSessao() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export function hashSenha(senha: string) {
  return bcrypt.hashSync(senha, 12)
}

export function verificarSenha(senha: string, hash: string) {
  return bcrypt.compareSync(senha, hash)
}
