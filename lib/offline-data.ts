import { espelharPresencasNaFilaDuravel, espelharRelatosAtrasoNaFilaDuravel, filaNativaDisponivel, migrarFilasLegadasParaNativa } from "@/lib/local-first-queue"

export const OFFLINE_DATA_EVENT = "santa-luzia:offline-data"

const ESCALAS_KEY = "santa-luzia:offline:v1:escalas"
const RANKING_KEY = "santa-luzia:offline:v1:ranking"
const SESSAO_KEY = "santa-luzia:offline:v1:sessao"
const ATRASOS_KEY = "santa-luzia:offline:v1:atrasos-pendentes"
const FORMACOES_KEY = "santa-luzia:offline:v1:formacoes"
const PRESENCAS_FORMACAO_KEY = "santa-luzia:offline:v1:presencas-formacao-pendentes"

type CacheEnvelope<T> = {
  atualizadoEm: number
  dados: T
}

export type RelatoAtrasoPayload = {
  action: "reportar_atraso"
  usuarioId: string
  dataMissa: string
  horarioMissa: string
  escalaId?: string | null
  observacao?: string
  clientRequestId: string
}

export type RelatoAtrasoPendente = {
  id: string
  reportadoPor: string
  criadoNoAparelhoEm: number
  tentativas: number
  ultimoErro?: string
  payload: RelatoAtrasoPayload
}

export type ResultadoRelatoAtraso =
  | { ok: true; pendente: false; resposta: any }
  | { ok: true; pendente: true; item: RelatoAtrasoPendente }
  | { ok: false; erro: string }

export type MinhaPresencaFormacaoSituacao = "presente" | "falta" | "justificada"

export type MinhaPresencaFormacaoPayload = {
  situacao: MinhaPresencaFormacaoSituacao
  justificativa: string
  clientRequestId: string
  criadoNoAparelhoEm?: number
}

export type PresencaFormacaoPendente = {
  id: string
  usuarioId: string
  formacaoId: string
  criadoNoAparelhoEm: number
  tentativas: number
  ultimoErro?: string
  payload: MinhaPresencaFormacaoPayload
}

export type ResultadoMinhaPresencaFormacao =
  | { ok: true; pendente: false; resposta: any }
  | { ok: true; pendente: true; item: PresencaFormacaoPendente }
  | { ok: false; erro: string }

function lerJson<T>(chave: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const valor = window.localStorage.getItem(chave)
    return valor ? JSON.parse(valor) as T : null
  } catch {
    return null
  }
}

function salvarJson(chave: string, valor: unknown) {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

function emitirAtualizacao(detalhe: Record<string, unknown>) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OFFLINE_DATA_EVENT, { detail: detalhe }))
}

function criarId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function carregarCacheEscalas<T>() {
  return lerJson<CacheEnvelope<T>>(ESCALAS_KEY)
}

export function salvarCacheEscalas<T>(dados: T) {
  const salvo = salvarJson(ESCALAS_KEY, { atualizadoEm: Date.now(), dados } satisfies CacheEnvelope<T>)
  if (salvo) emitirAtualizacao({ tipo: "escalas" })
  return salvo
}

export function carregarCacheFormacoes<T>() {
  return lerJson<CacheEnvelope<T>>(FORMACOES_KEY)
}

export function salvarCacheFormacoes<T>(dados: T) {
  const salvo = salvarJson(FORMACOES_KEY, { atualizadoEm: Date.now(), dados } satisfies CacheEnvelope<T>)
  if (salvo) emitirAtualizacao({ tipo: "formacoes" })
  return salvo
}

export function carregarCacheRanking<T>() {
  return lerJson<CacheEnvelope<T>>(RANKING_KEY)
}

export function salvarCacheRanking<T>(dados: T) {
  return salvarJson(RANKING_KEY, { atualizadoEm: Date.now(), dados } satisfies CacheEnvelope<T>)
}

export function carregarSessaoOffline<T>() {
  return lerJson<CacheEnvelope<T>>(SESSAO_KEY)
}

export function salvarSessaoOffline<T>(dados: T) {
  return salvarJson(SESSAO_KEY, { atualizadoEm: Date.now(), dados } satisfies CacheEnvelope<T>)
}

export function limparDadosPrivadosOffline() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(RANKING_KEY)
    window.localStorage.removeItem(SESSAO_KEY)
    window.localStorage.removeItem(FORMACOES_KEY)
    window.localStorage.removeItem(ESCALAS_KEY)
  } catch {}
  navigator.serviceWorker?.controller?.postMessage({ tipo: "LIMPAR_CACHE_PRIVADO" })
  if ("caches" in window) void window.caches.delete("santa-luzia-private-v1")
}

export function limparDadosOfflineAposExclusao(usuarioId: string) {
  const restantes = listarRelatosAtrasoPendentes().filter((item) => item.reportadoPor !== usuarioId)
  salvarRelatosAtrasoPendentes(restantes)
  const presencasRestantes = listarPresencasFormacaoPendentes().filter((item) => item.usuarioId !== usuarioId)
  salvarPresencasFormacaoPendentes(presencasRestantes)
  limparDadosPrivadosOffline()
}

export function listarRelatosAtrasoPendentes(reportadoPor?: string | null) {
  const itens = lerJson<RelatoAtrasoPendente[]>(ATRASOS_KEY)
  const validos = Array.isArray(itens) ? itens.filter((item) => item?.id && item?.payload?.clientRequestId) : []
  return reportadoPor ? validos.filter((item) => item.reportadoPor === reportadoPor) : validos
}

function salvarRelatosAtrasoPendentes(itens: RelatoAtrasoPendente[]) {
  const salvo = salvarJson(ATRASOS_KEY, itens)
  if (salvo) {
    espelharRelatosAtrasoNaFilaDuravel(itens)
    emitirAtualizacao({ tipo: "atrasos", pendentes: itens.length })
  }
  return salvo
}

function colocarRelatoNaFila(payload: Omit<RelatoAtrasoPayload, "clientRequestId"> & { clientRequestId?: string }, reportadoPor: string) {
  const atuais = listarRelatosAtrasoPendentes()
  const repetido = atuais.find((item) =>
    item.reportadoPor === reportadoPor &&
    item.payload.usuarioId === payload.usuarioId &&
    item.payload.dataMissa === payload.dataMissa,
  )
  if (repetido) return repetido

  const clientRequestId = payload.clientRequestId || criarId()
  const item: RelatoAtrasoPendente = {
    id: clientRequestId,
    reportadoPor,
    criadoNoAparelhoEm: Date.now(),
    tentativas: 0,
    payload: { ...payload, action: "reportar_atraso", clientRequestId },
  }
  salvarRelatosAtrasoPendentes([...atuais, item])
  return item
}

async function respostaJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, any>>
}

export async function enviarOuEnfileirarRelatoAtraso(
  payload: Omit<RelatoAtrasoPayload, "action" | "clientRequestId">,
  reportadoPor: string,
): Promise<ResultadoRelatoAtraso> {
  const completo: RelatoAtrasoPayload = {
    ...payload,
    action: "reportar_atraso",
    clientRequestId: criarId(),
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const response = await fetch("/api/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(completo),
      })
      const json = await respostaJson(response)
      if (response.ok) return { ok: true, pendente: false, resposta: json }
      if (response.status < 500) return { ok: false, erro: String(json.erro || "Não foi possível enviar o relato.") }
    } catch {}
  }

  const item = colocarRelatoNaFila(completo, reportadoPor)
  return { ok: true, pendente: true, item }
}

export async function sincronizarRelatosAtrasoPendentes() {
  if (typeof window === "undefined" || !navigator.onLine) return { enviados: 0, restantes: listarRelatosAtrasoPendentes().length }
  if (await filaNativaDisponivel()) {
    await migrarFilasLegadasParaNativa()
    return { enviados: 0, restantes: listarRelatosAtrasoPendentes().length }
  }

  const todos = listarRelatosAtrasoPendentes()
  if (!todos.length) return { enviados: 0, restantes: 0 }

  let usuarioAtual = ""
  try {
    const sessao = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
    const json = await sessao.json()
    usuarioAtual = String(json?.sessao?.usuario?.id || "")
  } catch {
    return { enviados: 0, restantes: todos.length }
  }
  if (!usuarioAtual) return { enviados: 0, restantes: todos.length }

  const mantidos: RelatoAtrasoPendente[] = []
  let enviados = 0

  for (let index = 0; index < todos.length; index += 1) {
    const item = todos[index]
    if (item.reportadoPor !== usuarioAtual) {
      mantidos.push(item)
      continue
    }

    try {
      const response = await fetch("/api/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(item.payload),
      })
      const json = await respostaJson(response)
      if (response.ok || response.status === 409) {
        enviados += 1
        continue
      }

      const atualizado = { ...item, tentativas: item.tentativas + 1, ultimoErro: String(json.erro || `HTTP ${response.status}`) }
      mantidos.push(atualizado)
      if (response.status === 401 || response.status === 403 || response.status >= 500) {
        mantidos.push(...todos.slice(index + 1))
        break
      }
    } catch {
      mantidos.push({ ...item, tentativas: item.tentativas + 1, ultimoErro: "Sem conexão com o servidor." }, ...todos.slice(index + 1))
      break
    }
  }

  salvarRelatosAtrasoPendentes(mantidos)
  return { enviados, restantes: mantidos.length }
}


export function listarPresencasFormacaoPendentes(usuarioId?: string | null) {
  const itens = lerJson<PresencaFormacaoPendente[]>(PRESENCAS_FORMACAO_KEY)
  const validos = Array.isArray(itens)
    ? itens.filter((item) => item?.id && item?.usuarioId && item?.formacaoId && item?.payload?.clientRequestId)
    : []
  return usuarioId ? validos.filter((item) => item.usuarioId === usuarioId) : validos
}

function salvarPresencasFormacaoPendentes(itens: PresencaFormacaoPendente[]) {
  const salvo = salvarJson(PRESENCAS_FORMACAO_KEY, itens)
  if (salvo) {
    espelharPresencasNaFilaDuravel(itens)
    emitirAtualizacao({ tipo: "presencas-formacao", pendentes: itens.length })
  }
  return salvo
}

function colocarPresencaFormacaoNaFila(
  formacaoId: string,
  payload: Omit<MinhaPresencaFormacaoPayload, "clientRequestId"> & { clientRequestId?: string },
  usuarioId: string,
) {
  const atuais = listarPresencasFormacaoPendentes()
  const outros = atuais.filter((item) => item.usuarioId !== usuarioId || item.formacaoId !== formacaoId)
  const clientRequestId = payload.clientRequestId || criarId()
  const criadoNoAparelhoEm = Number.isFinite(Number(payload.criadoNoAparelhoEm)) && Number(payload.criadoNoAparelhoEm) > 0
    ? Number(payload.criadoNoAparelhoEm)
    : Date.now()
  const item: PresencaFormacaoPendente = {
    id: clientRequestId,
    usuarioId,
    formacaoId,
    criadoNoAparelhoEm,
    tentativas: 0,
    payload: { ...payload, clientRequestId, criadoNoAparelhoEm },
  }
  salvarPresencasFormacaoPendentes([...outros, item])
  return item
}

function removerPresencaFormacaoPendente(usuarioId: string, formacaoId: string) {
  const atuais = listarPresencasFormacaoPendentes()
  salvarPresencasFormacaoPendentes(
    atuais.filter((item) => item.usuarioId !== usuarioId || item.formacaoId !== formacaoId),
  )
}

export async function enviarOuEnfileirarMinhaPresencaFormacao(
  formacaoId: string,
  payload: Omit<MinhaPresencaFormacaoPayload, "clientRequestId" | "criadoNoAparelhoEm">,
  usuarioId: string,
): Promise<ResultadoMinhaPresencaFormacao> {
  const completo: MinhaPresencaFormacaoPayload = {
    ...payload,
    clientRequestId: criarId(),
    criadoNoAparelhoEm: Date.now(),
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const response = await fetch(`/api/formacoes/${encodeURIComponent(formacaoId)}/minha-presenca`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(completo),
      })
      const json = await respostaJson(response)
      if (response.ok) {
        removerPresencaFormacaoPendente(usuarioId, formacaoId)
        return { ok: true, pendente: false, resposta: json }
      }
      if (response.status < 500 && response.status !== 408 && response.status !== 429) {
        return { ok: false, erro: String(json.erro || "Não foi possível registrar sua presença.") }
      }
    } catch {}
  }

  const item = colocarPresencaFormacaoNaFila(formacaoId, completo, usuarioId)
  return { ok: true, pendente: true, item }
}

export async function sincronizarPresencasFormacaoPendentes() {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { enviados: 0, restantes: listarPresencasFormacaoPendentes().length }
  }
  if (await filaNativaDisponivel()) {
    await migrarFilasLegadasParaNativa()
    return { enviados: 0, restantes: listarPresencasFormacaoPendentes().length }
  }

  const todos = listarPresencasFormacaoPendentes()
  if (!todos.length) return { enviados: 0, restantes: 0 }

  let usuarioAtual = ""
  try {
    const sessao = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
    const json = await sessao.json()
    usuarioAtual = String(json?.sessao?.usuario?.id || "")
  } catch {
    return { enviados: 0, restantes: todos.length }
  }
  if (!usuarioAtual) return { enviados: 0, restantes: todos.length }

  const mantidos: PresencaFormacaoPendente[] = []
  let enviados = 0

  for (let index = 0; index < todos.length; index += 1) {
    const item = todos[index]
    if (item.usuarioId !== usuarioAtual) {
      mantidos.push(item)
      continue
    }

    try {
      const response = await fetch(`/api/formacoes/${encodeURIComponent(item.formacaoId)}/minha-presenca`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...item.payload, criadoNoAparelhoEm: item.criadoNoAparelhoEm }),
      })
      const json = await respostaJson(response)

      if (response.ok || (response.status === 409 && json.presenca)) {
        enviados += 1
        continue
      }
      if (response.status === 404) {
        continue
      }

      const atualizado = {
        ...item,
        tentativas: item.tentativas + 1,
        ultimoErro: String(json.erro || `HTTP ${response.status}`),
      }
      mantidos.push(atualizado)
      if (response.status === 401 || response.status === 403 || response.status >= 500) {
        mantidos.push(...todos.slice(index + 1))
        break
      }
    } catch {
      mantidos.push(
        { ...item, tentativas: item.tentativas + 1, ultimoErro: "Sem conexão com o servidor." },
        ...todos.slice(index + 1),
      )
      break
    }
  }

  salvarPresencasFormacaoPendentes(mantidos)
  return { enviados, restantes: mantidos.length }
}
