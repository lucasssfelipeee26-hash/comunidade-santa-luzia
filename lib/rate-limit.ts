type Entrada = { quantidade: number; resetEm: number }

type StoreGlobal = typeof globalThis & {
  __santaLuziaRateLimit?: Map<string, Entrada>
  __santaLuziaRateLimitUltimaLimpeza?: number
}

const g = globalThis as StoreGlobal
const store = g.__santaLuziaRateLimit ?? new Map<string, Entrada>()
if (!g.__santaLuziaRateLimit) g.__santaLuziaRateLimit = store

const MAX_CHAVES = 5_000
const INTERVALO_LIMPEZA = 60_000

function limparStore(agora: number) {
  const ultima = g.__santaLuziaRateLimitUltimaLimpeza ?? 0
  if (agora - ultima < INTERVALO_LIMPEZA && store.size <= MAX_CHAVES) return
  g.__santaLuziaRateLimitUltimaLimpeza = agora

  for (const [key, entrada] of store) {
    if (agora >= entrada.resetEm) store.delete(key)
  }

  if (store.size <= MAX_CHAVES) return
  const excedentes = [...store.entries()]
    .sort((a, b) => a[1].resetEm - b[1].resetEm)
    .slice(0, store.size - MAX_CHAVES)
  for (const [key] of excedentes) store.delete(key)
}

export function ipDaRequisicao(req: Request) {
  const encaminhado = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return encaminhado || req.headers.get("x-real-ip")?.trim() || "desconhecido"
}

export function limitar(key: string, limite: number, janelaMs: number) {
  const agora = Date.now()
  limparStore(agora)

  const atual = store.get(key)
  if (!atual || agora >= atual.resetEm) {
    store.set(key, { quantidade: 1, resetEm: agora + janelaMs })
    return { permitido: true, restante: limite - 1 }
  }

  if (atual.quantidade >= limite) {
    return { permitido: false, restante: 0, resetEm: atual.resetEm }
  }

  atual.quantidade += 1
  return { permitido: true, restante: Math.max(0, limite - atual.quantidade), resetEm: atual.resetEm }
}
