type Entrada = { quantidade: number; resetEm: number }

type StoreGlobal = typeof globalThis & { __santaLuziaRateLimit?: Map<string, Entrada> }

const g = globalThis as StoreGlobal
const store = g.__santaLuziaRateLimit ?? new Map<string, Entrada>()
if (!g.__santaLuziaRateLimit) g.__santaLuziaRateLimit = store

export function ipDaRequisicao(req: Request) {
  const encaminhado = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return encaminhado || req.headers.get("x-real-ip")?.trim() || "desconhecido"
}

export function limitar(key: string, limite: number, janelaMs: number) {
  const agora = Date.now()
  const atual = store.get(key)
  if (!atual || agora >= atual.resetEm) {
    store.set(key, { quantidade: 1, resetEm: agora + janelaMs })
    return { permitido: true, restante: limite - 1 }
  }

  if (atual.quantidade >= limite) {
    return { permitido: false, restante: 0, resetEm: atual.resetEm }
  }

  atual.quantidade += 1
  return { permitido: true, restante: Math.max(0, limite - atual.quantidade) }
}
