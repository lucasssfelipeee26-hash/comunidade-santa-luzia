const ATRASOS_KEY = "santa-luzia:offline:v1:atrasos-pendentes"
const PRESENCAS_KEY = "santa-luzia:offline:v1:presencas-formacao-pendentes"

export type LocalFirstQueueItem = {
  id: string
  tipo: "atraso" | "formacao-presenca" | "quiz-liturgia"
  criadoEm?: number
  ownerId?: string
  formacaoId?: string
  payload: Record<string, unknown>
}

type LegacyDelay = {
  id?: string
  reportadoPor?: string
  criadoNoAparelhoEm?: number
  payload?: Record<string, unknown> & { clientRequestId?: string }
}

type LegacyFormation = {
  id?: string
  usuarioId?: string
  formacaoId?: string
  criadoNoAparelhoEm?: number
  payload?: Record<string, unknown> & { clientRequestId?: string }
}

function parseArray<T>(value: string | null): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function legacyItems(): LocalFirstQueueItem[] {
  if (typeof window === "undefined") return []
  const delays = parseArray<LegacyDelay>(window.localStorage.getItem(ATRASOS_KEY))
    .filter((item) => item?.id && item?.payload)
    .map((item) => ({
      id: String(item.id),
      tipo: "atraso" as const,
      criadoEm: Number(item.criadoNoAparelhoEm || Date.now()),
      ownerId: item.reportadoPor ? String(item.reportadoPor) : undefined,
      payload: item.payload || {},
    }))

  const formations = parseArray<LegacyFormation>(window.localStorage.getItem(PRESENCAS_KEY))
    .filter((item) => item?.id && item?.payload && item?.formacaoId)
    .map((item) => ({
      id: String(item.id),
      tipo: "formacao-presenca" as const,
      criadoEm: Number(item.criadoNoAparelhoEm || Date.now()),
      ownerId: item.usuarioId ? String(item.usuarioId) : undefined,
      formacaoId: String(item.formacaoId),
      payload: item.payload || {},
    }))

  return [...delays, ...formations]
}

async function nativeStore() {
  if (typeof window === "undefined") return null
  try {
    const [{ Capacitor }, { OfflineStore }] = await Promise.all([
      import("@capacitor/core"),
      import("@/lib/native-offline-store"),
    ])
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("OfflineStore")) return null
    return OfflineStore
  } catch {
    return null
  }
}

export async function filaNativaDisponivel() {
  return Boolean(await nativeStore())
}

export async function lerFilaDuravel(): Promise<LocalFirstQueueItem[]> {
  const store = await nativeStore()
  if (!store) return []
  try {
    const result = await store.loadQueue()
    return parseArray<LocalFirstQueueItem>(result.queue)
      .filter((item) => item?.id && item?.tipo && item?.payload)
  } catch {
    return []
  }
}

export async function mesclarNaFilaDuravel(items: LocalFirstQueueItem[]) {
  if (!items.length) return false
  const store = await nativeStore()
  if (!store) return false
  try {
    const current = await lerFilaDuravel()
    const byId = new Map<string, LocalFirstQueueItem>()
    for (const item of current) byId.set(String(item.id), item)
    for (const item of items) {
      const id = String(item.id || "")
      if (!id) continue
      const existing = byId.get(id)
      byId.set(id, {
        ...(existing || {}),
        ...item,
        id,
        ownerId: item.ownerId || existing?.ownerId,
      })
    }
    await store.saveQueue({ queue: JSON.stringify([...byId.values()]) })
    return true
  } catch {
    return false
  }
}

export async function migrarFilasLegadasParaNativa() {
  return mesclarNaFilaDuravel(legacyItems())
}

export function espelharRelatosAtrasoNaFilaDuravel(items: LegacyDelay[]) {
  const mapped = (Array.isArray(items) ? items : [])
    .filter((item) => item?.id && item?.payload)
    .map((item) => ({
      id: String(item.id),
      tipo: "atraso" as const,
      criadoEm: Number(item.criadoNoAparelhoEm || Date.now()),
      ownerId: item.reportadoPor ? String(item.reportadoPor) : undefined,
      payload: item.payload || {},
    }))
  void mesclarNaFilaDuravel(mapped)
}

export function espelharPresencasNaFilaDuravel(items: LegacyFormation[]) {
  const mapped = (Array.isArray(items) ? items : [])
    .filter((item) => item?.id && item?.payload && item?.formacaoId)
    .map((item) => ({
      id: String(item.id),
      tipo: "formacao-presenca" as const,
      criadoEm: Number(item.criadoNoAparelhoEm || Date.now()),
      ownerId: item.usuarioId ? String(item.usuarioId) : undefined,
      formacaoId: String(item.formacaoId),
      payload: item.payload || {},
    }))
  void mesclarNaFilaDuravel(mapped)
}

export function removerEspelhosLegados(ids: string[]) {
  if (typeof window === "undefined" || !ids.length) return
  const removidos = new Set(ids.map(String))
  try {
    const delays = parseArray<LegacyDelay>(window.localStorage.getItem(ATRASOS_KEY))
      .filter((item) => !removidos.has(String(item?.id || "")))
    window.localStorage.setItem(ATRASOS_KEY, JSON.stringify(delays))

    const formations = parseArray<LegacyFormation>(window.localStorage.getItem(PRESENCAS_KEY))
      .filter((item) => !removidos.has(String(item?.id || "")))
    window.localStorage.setItem(PRESENCAS_KEY, JSON.stringify(formations))
  } catch {
    // O SQLite continua sendo a fonte durável no Android.
  }
}
