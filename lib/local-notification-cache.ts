import type { LocalFirstQueueItem } from "@/lib/local-first-queue"
import { mesclarNaFilaDuravel } from "@/lib/local-first-queue"

const CACHE_PREFIX = "santa-luzia:notificacoes-cache:v1:"
const CACHE_LAST_USER = "santa-luzia:notificacoes-cache:ultimo-usuario"
const MAX_CACHE_AGE = 7 * 24 * 60 * 60_000

export type CachedNotification = {
  id: string
  tipo?: string
  titulo: string
  mensagem: string
  href: string
  criado_em?: number
  lida_em: number | null
}

export type CachedNotificationData = {
  cachedAt: number
  usuarioId: string
  notificacoes: CachedNotification[]
  naoLidas: number
}

function storageKey(usuarioId: string) {
  return `${CACHE_PREFIX}${usuarioId}`
}

function parseCache(raw: string | null): CachedNotificationData | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CachedNotificationData>
    if (!parsed || typeof parsed !== "object" || !parsed.usuarioId || !Array.isArray(parsed.notificacoes)) return null
    const cachedAt = Number(parsed.cachedAt || 0)
    if (!Number.isFinite(cachedAt) || cachedAt <= 0 || Date.now() - cachedAt > MAX_CACHE_AGE) return null
    return {
      cachedAt,
      usuarioId: String(parsed.usuarioId),
      notificacoes: parsed.notificacoes.filter((n): n is CachedNotification => Boolean(n?.id && n?.titulo && n?.mensagem && n?.href)),
      naoLidas: Number(parsed.naoLidas || 0),
    }
  } catch {
    return null
  }
}

export function ultimoUsuarioNotificacoes() {
  if (typeof window === "undefined") return ""
  try { return window.localStorage.getItem(CACHE_LAST_USER) || "" } catch { return "" }
}

export function carregarNotificacoesCache(usuarioId?: string | null) {
  if (typeof window === "undefined") return null
  const id = String(usuarioId || ultimoUsuarioNotificacoes() || "")
  if (!id) return null
  try { return parseCache(window.localStorage.getItem(storageKey(id))) } catch { return null }
}

export async function salvarNotificacoesCache(
  usuarioId: string,
  notificacoes: CachedNotification[],
  naoLidas?: number,
) {
  if (typeof window === "undefined" || !usuarioId) return
  const dados: CachedNotificationData = {
    cachedAt: Date.now(),
    usuarioId,
    notificacoes: Array.isArray(notificacoes) ? notificacoes.slice(0, 100) : [],
    naoLidas: Number.isFinite(Number(naoLidas))
      ? Math.max(0, Number(naoLidas))
      : (Array.isArray(notificacoes) ? notificacoes.filter((n) => !n.lida_em).length : 0),
  }

  try {
    window.localStorage.setItem(CACHE_LAST_USER, usuarioId)
    window.localStorage.setItem(storageKey(usuarioId), JSON.stringify(dados))
  } catch {}

  try {
    const [{ Capacitor }, { OfflineStore }] = await Promise.all([
      import("@capacitor/core"),
      import("@/lib/native-offline-store"),
    ])
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("OfflineStore")) {
      await OfflineStore.saveDocument({ key: `notifications:${usuarioId}`, value: JSON.stringify(dados) })
    }
  } catch {
    // Builds antigas podem não ter saveDocument; o cache web permanece como fallback.
  }
}

export function marcarCacheComoLido(usuarioId: string, ids?: string[] | null) {
  const cache = carregarNotificacoesCache(usuarioId)
  if (!cache) return
  const agora = Date.now()
  const alvo = ids?.length ? new Set(ids.map(String)) : null
  const notificacoes = cache.notificacoes.map((n) =>
    (!alvo || alvo.has(n.id)) && !n.lida_em ? { ...n, lida_em: agora } : n,
  )
  void salvarNotificacoesCache(usuarioId, notificacoes, notificacoes.filter((n) => !n.lida_em).length)
}

export function enfileirarNotificacaoLida(usuarioId: string, id: string) {
  if (!usuarioId || !id) return
  const item: LocalFirstQueueItem = {
    id: `notificacao-lida:${usuarioId}:${id}`,
    tipo: "notificacao-lida",
    criadoEm: Date.now(),
    ownerId: usuarioId,
    payload: { id },
  }
  void mesclarNaFilaDuravel([item])
}

export function enfileirarTodasNotificacoesLidas(usuarioId: string) {
  if (!usuarioId) return
  const item: LocalFirstQueueItem = {
    id: `notificacoes-todas-lidas:${usuarioId}`,
    tipo: "notificacao-lida",
    criadoEm: Date.now(),
    ownerId: usuarioId,
    payload: { action: "todas" },
  }
  void mesclarNaFilaDuravel([item])
}
