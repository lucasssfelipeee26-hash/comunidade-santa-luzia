// Authentication must never accept a stale anonymous response after login.
export type AuthSession = { sessao: null | { tipo: "moderador" | "membro"; usuario: { id: string; nome: string } } }
const unavailable = "O servidor de acesso está indisponível. Tente novamente mais tarde."
let authMeInFlight: { generation: number; promise: Promise<unknown> } | null = null
let authGeneration = 0

function transport(): typeof fetch {
  const native = typeof window !== "undefined" && (window as unknown as {
    __santaLuziaNativeApiFetch?: typeof fetch
  }).__santaLuziaNativeApiFetch
  return native || fetch
}

async function requestJson(path: string, init: RequestInit = {}) {
  const response = await transport()(path, { ...init, cache: "no-store", credentials: "same-origin" })
  const json = await response.json().catch(() => null)
  if (!json || response.status === 404 || response.status >= 500) throw new Error(unavailable)
  if (!response.ok) throw new Error(typeof json.erro === "string" ? json.erro : "Não foi possível confirmar o acesso.")
  return json
}

export async function authJson(path: string, init: RequestInit = {}) {
  const method = String(init.method || "GET").toUpperCase()
  if (path === "/api/auth/me" && method === "GET") {
    const generation = authGeneration
    if (authMeInFlight?.generation === generation) return authMeInFlight.promise

    const promise = requestJson(path, init)
    authMeInFlight = { generation, promise }
    try {
      return await promise
    } finally {
      if (authMeInFlight?.promise === promise) authMeInFlight = null
    }
  }

  // Authentication mutations invalidate only the in-flight generation. We do
  // not cache a resolved /auth/me response, so the post-login confirmation is
  // always a fresh server check while concurrent readers still share one call.
  if (path.startsWith("/api/auth/") && method !== "GET") {
    authGeneration += 1
    authMeInFlight = null
  }
  return requestJson(path, init)
}

export function validSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object" || !("sessao" in value)) return false
  const session = (value as AuthSession).sessao
  return session === null || Boolean(session && ["membro", "moderador"].includes(session.tipo) && session.usuario?.id && session.usuario?.nome)
}

export async function loginConfirmed(usuario: string, senha: string) {
  try {
    const result = await authJson("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, senha }),
    })
    if (result.ok !== true) return { ok: false as const, erro: result.erro || "Não foi possível entrar." }
    const me: unknown = await authJson("/api/auth/me")
    if (!validSession(me) || !me.sessao || (result.usuario?.id && result.usuario.id !== me.sessao.usuario.id)) {
      return { ok: false as const, erro: "Não foi possível manter sua sessão. Tente entrar novamente." }
    }
    return { ok: true as const, me, destino: me.sessao.tipo === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro" }
  } catch (error) {
    return { ok: false as const, erro: error instanceof Error && !(error instanceof TypeError) ? error.message : "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente." }
  }
}
