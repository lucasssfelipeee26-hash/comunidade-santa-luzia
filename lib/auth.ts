import "server-only"

import { createHash } from "node:crypto"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { APP_AUTH_RELEASE } from "@/lib/app-release"
import { buscarUsuario } from "@/lib/db"

const COOKIE_NAME = "santa_luzia_sessao"

function getSecret() {
  const valor = process.env.AUTH_SECRET?.trim()
  if (!valor && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET não configurado. Defina a variável de ambiente antes de usar a Área Restrita em produção.")
  }
  return new TextEncoder().encode(valor || "dev-somente-troque-este-segredo-em-producao-santa-luzia")
}

function credencialDaSenhaHash(senhaHash: string) {
  return createHash("sha256").update(`santa-luzia:${senhaHash}`).digest("hex")
}

export type SessaoPayload = {
  sub: string
  tipo: "moderador" | "membro"
  versao: string
  cred?: string
}

export async function criarSessao(payload: Omit<SessaoPayload, "versao" | "cred">) {
  const usuario = buscarUsuario(payload.sub)
  if (!usuario) throw new Error("Não foi possível criar sessão para uma conta inexistente.")

  const cred = credencialDaSenhaHash(usuario.senha_hash)
  const token = await new SignJWT({ ...payload, versao: APP_AUTH_RELEASE, cred })
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
    maxAge: 60 * 60 * 24 * 400,
  })
}

/**
 * Valida a assinatura do cookie e consulta a conta atual em toda requisição.
 * O token prova a identidade; tipo/status atuais vêm sempre do banco.
 */
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

    const usuario = buscarUsuario(payload.sub)
    if (!usuario) return null

    // Tokens emitidos a partir desta auditoria carregam uma impressão da
    // credencial. Se a senha for redefinida, eles deixam de valer imediatamente.
    // Tokens antigos continuam compatíveis para não expulsar todo mundo da conta
    // durante uma atualização; no próximo login já passam a ter essa proteção.
    if (typeof payload.cred === "string" && payload.cred !== credencialDaSenhaHash(usuario.senha_hash)) {
      return null
    }

    if (usuario.tipo === "membro" && usuario.status !== "aprovado") return null

    return {
      sub: usuario.id,
      tipo: usuario.tipo,
      versao: APP_AUTH_RELEASE,
      cred: typeof payload.cred === "string" ? payload.cred : undefined,
    }
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
