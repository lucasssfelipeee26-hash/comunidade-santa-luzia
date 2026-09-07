"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { OfflineStore } from "@/lib/native-offline-store"
import { OFFLINE_DATA_EVENT } from "@/lib/offline-data"
import { migrarFilasLegadasParaNativa, removerEspelhosLegados } from "@/lib/local-first-queue"
import { useAuthSession } from "@/components/auth-session-runtime"

type QueueItem = {
  id: string
  tipo: "atraso" | "formacao-presenca" | "quiz-liturgia" | "notificacao-lida"
  criadoEm?: number
  ownerId?: string
  formacaoId?: string
  payload: Record<string, unknown>
}

const BRIDGE_ORIGIN = "https://localhost"
const BRIDGE_URL = `${BRIDGE_ORIGIN}/offline-bridge.html`
const TIMEOUT = 7_000
const SNAPSHOT_REVISION_KEY = "santa-luzia:local-first:snapshot-revision"
const SNAPSHOT_USER_KEY = "santa-luzia:local-first:snapshot-user"
const SERVER_REVISION_KEY = "santa-luzia:ultima-revisao-servidor"
const INTERVALO_SNAPSHOT = 5 * 60_000
const SNAPSHOT_AFTER_ROUTE_MS = 700

function lerLocal(chave: string) {
  try { return window.localStorage.getItem(chave) } catch { return null }
}

function salvarLocal(chave: string, valor: string) {
  try { window.localStorage.setItem(chave, valor) } catch {}
}

function removerLocal(chave: string) {
  try { window.localStorage.removeItem(chave) } catch {}
}

function rotaEmTransicao() {
  return document.documentElement.dataset.slRouteTransition === "running"
}

async function jsonComTimeout(url: string) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export function AndroidOfflineSnapshotRuntime() {
  const { liveSession } = useAuthSession()

  useEffect(() => {
    if (!liveSession?.usuario?.id || !liveSession?.tipo) return
    if (!navigator.userAgent.includes("SantaLuziaAndroid") && !Capacitor.isNativePlatform()) return

    const sessao = liveSession
    let encerrado = false
    let iframe: HTMLIFrameElement | null = null
    let bridgePronto = false
    let salvando = false
    let drenando = false
    let snapshotTimer: number | null = null
    const usaNativo = Capacitor.isPluginAvailable("OfflineStore")
    const beta10Local = navigator.userAgent.includes("SantaLuziaOriginalUIOffline/2")

    if (beta10Local && !usaNativo) return

    function enviarBridge(message: Record<string, unknown>) {
      if (!bridgePronto || !iframe?.contentWindow) return
      iframe.contentWindow.postMessage(message, BRIDGE_ORIGIN)
    }

    async function salvarSnapshotPersistente(snapshot: Record<string, unknown>) {
      const texto = JSON.stringify(snapshot)
      if (usaNativo) {
        await OfflineStore.saveSnapshot({ snapshot: texto })
        const documentos: Array<[string, unknown]> = [
          ["snapshot:auth", snapshot.auth ?? null],
          ["snapshot:perfil", snapshot.perfil ?? null],
          ["snapshot:perfis", snapshot.perfis ?? []],
          ["snapshot:formacoes", snapshot.formacoes ?? { formacoes: [] }],
          ["snapshot:ranking", snapshot.ranking ?? { ranking: [], membros: [], ocorrencias: [] }],
          ["snapshot:quizzes", snapshot.quizzes ?? { quizzes: [] }],
          ["snapshot:escalas", snapshot.escalas ?? { escalas: [] }],
          ["snapshot:biblioteca", snapshot.biblioteca ?? { livros: [] }],
        ]
        await Promise.allSettled(documentos.map(([key, value]) =>
          OfflineStore.saveDocument({ key, value: JSON.stringify(value) })
        ))
      } else enviarBridge({ type: "SL_OFFLINE_SAVE_SNAPSHOT", snapshot })
    }

    async function limparPersistente() {
      if (usaNativo) await OfflineStore.clear().catch(() => undefined)
      else enviarBridge({ type: "SL_OFFLINE_CLEAR" })
      removerLocal(SNAPSHOT_REVISION_KEY)
      removerLocal(SNAPSHOT_USER_KEY)
      removerLocal("santa-luzia:offline:v1:quizzes")
    }

    async function lerFila(): Promise<QueueItem[]> {
      if (usaNativo) {
        try {
          const result = await OfflineStore.loadQueue()
          const parsed = JSON.parse(result.queue || "[]")
          return Array.isArray(parsed) ? parsed : []
        } catch { return [] }
      }
      enviarBridge({ type: "SL_OFFLINE_GET_QUEUE" })
      return []
    }

    async function salvarFila(itens: QueueItem[]) {
      if (usaNativo) await OfflineStore.saveQueue({ queue: JSON.stringify(itens) }).catch(() => undefined)
    }

    async function salvarSnapshot() {
      if (encerrado || salvando || !navigator.onLine || rotaEmTransicao()) return
      if (!usaNativo && !bridgePronto) return
      salvando = true
      try {
        const usuarioId = String(sessao.usuario.id)
        const revisaoDados = String(lerLocal(SERVER_REVISION_KEY) || "")
        const mesmaRevisao = Boolean(revisaoDados && lerLocal(SNAPSHOT_REVISION_KEY) === revisaoDados)
        const mesmoUsuario = lerLocal(SNAPSHOT_USER_KEY) === usuarioId
        if (mesmaRevisao && mesmoUsuario) return

        // Evita o thundering herd observado na auditoria. O snapshot continua completo,
        // mas coleta em pequenos lotes para não disputar CPU/rede com a tela recém-aberta.
        const [perfilResposta, perfisResposta] = await Promise.all([
          jsonComTimeout("/api/perfil"),
          jsonComTimeout("/api/perfis"),
        ])
        if (encerrado || rotaEmTransicao()) return
        const [formacoes, escalas] = await Promise.all([
          jsonComTimeout("/api/formacoes"),
          jsonComTimeout("/api/escalas"),
        ])
        if (encerrado || rotaEmTransicao()) return
        const [ranking, biblioteca, quizzes] = await Promise.all([
          jsonComTimeout("/api/ranking"),
          jsonComTimeout("/api/biblioteca"),
          jsonComTimeout("/api/quizzes"),
        ])
        if (encerrado || rotaEmTransicao()) return

        const usuario = sessao.usuario
        const perfil = perfilResposta?.perfil
        const snapshot = {
          versao: 4,
          atualizadoEm: Date.now(),
          revisaoDados: revisaoDados || null,
          auth: {
            sessao: {
              tipo: sessao.tipo,
              usuario: {
                id: usuario.id,
                nome: usuario.nome,
                funcao: usuario.funcao ?? null,
                desde: usuario.desde ?? null,
                foto: (usuario as typeof usuario & { foto?: string | null }).foto ?? null,
              },
            },
          },
          perfil: perfil ? {
            id: perfil.id,
            nome: perfil.nome,
            funcao: perfil.funcao,
            desde: perfil.desde,
            foto: perfil.foto ?? null,
            bio: perfil.bio ?? "",
          } : null,
          perfis: Array.isArray(perfisResposta?.perfis) ? perfisResposta.perfis : [],
          formacoes: formacoes || { formacoes: [] },
          ranking: ranking ? {
            eu: ranking.eu,
            ranking: ranking.ranking || [],
            membros: ranking.membros || [],
            ocorrencias: ranking.ocorrencias || [],
          } : { ranking: [], membros: [], ocorrencias: [] },
          escalas: escalas || { escalas: [] },
          quizzes: quizzes || { quizzes: [] },
          biblioteca: biblioteca || { livros: [] },
        }

        await salvarSnapshotPersistente(snapshot)
        salvarLocal("santa-luzia:offline:v1:quizzes", JSON.stringify({ atualizadoEm: Date.now(), dados: quizzes || { quizzes: [] } }))
        if (revisaoDados) salvarLocal(SNAPSHOT_REVISION_KEY, revisaoDados)
        salvarLocal(SNAPSHOT_USER_KEY, usuarioId)
      } finally {
        salvando = false
      }
    }

    function agendarSnapshot(delay = SNAPSHOT_AFTER_ROUTE_MS) {
      if (encerrado) return
      if (snapshotTimer !== null) window.clearTimeout(snapshotTimer)
      snapshotTimer = window.setTimeout(() => {
        snapshotTimer = null
        if (rotaEmTransicao()) {
          agendarSnapshot(SNAPSHOT_AFTER_ROUTE_MS)
          return
        }
        void salvarSnapshot()
      }, delay)
    }

    async function enviarItem(item: QueueItem) {
      if (item.tipo === "atraso") {
        const response = await fetch("/api/ranking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(item.payload),
        })
        return response.ok || response.status === 409
      }
      if (item.tipo === "formacao-presenca" && item.formacaoId) {
        const response = await fetch(`/api/formacoes/${encodeURIComponent(item.formacaoId)}/minha-presenca`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(item.payload),
        })
        return response.ok
      }
      if (item.tipo === "quiz-liturgia") {
        const response = await fetch("/api/quizzes/liturgia/offline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(item.payload),
        })
        return response.ok || response.status === 409
      }
      if (item.tipo === "notificacao-lida") {
        const response = await fetch("/api/notificacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(item.payload),
        })
        return response.ok || response.status === 404
      }
      return false
    }

    async function drenarFila(items: QueueItem[]) {
      if (encerrado || drenando || !navigator.onLine || !Array.isArray(items) || !items.length || rotaEmTransicao()) return
      drenando = true
      const restantes: QueueItem[] = []
      try {
        const usuarioAtual = String(sessao.usuario.id)
        for (const item of items) {
          if (item.ownerId && String(item.ownerId) !== usuarioAtual) {
            restantes.push(item)
            continue
          }
          try {
            if (!(await enviarItem(item))) restantes.push(item)
          } catch {
            restantes.push(item)
          }
        }
        const removidos = items.filter((item) => !restantes.some((r) => r.id === item.id)).map((item) => String(item.id))
        if (usaNativo) {
          await salvarFila(restantes)
          if (removidos.length) removerEspelhosLegados(removidos)
        } else if (removidos.length) {
          enviarBridge({ type: "SL_OFFLINE_QUEUE_REMOVE", ids: removidos })
        }
        if (restantes.length !== items.length) {
          window.dispatchEvent(new CustomEvent("santa-luzia:server-sync", { detail: { origem: "android-offline-queue", imediato: true } }))
          agendarSnapshot()
        }
      } finally {
        drenando = false
      }
    }

    async function pedirFila() {
      if (!navigator.onLine || rotaEmTransicao()) return
      if (usaNativo) {
        await migrarFilasLegadasParaNativa()
        void drenarFila(await lerFila())
      } else enviarBridge({ type: "SL_OFFLINE_GET_QUEUE" })
    }

    function aoMensagem(event: MessageEvent) {
      if (event.origin !== BRIDGE_ORIGIN || usaNativo) return
      const data = event.data || {}
      if (data.type === "SL_OFFLINE_BRIDGE_READY") {
        bridgePronto = true
        agendarSnapshot()
        void pedirFila()
      } else if (data.type === "SL_OFFLINE_QUEUE") {
        void drenarFila(Array.isArray(data.items) ? data.items : [])
      }
    }

    const aoOnline = () => { agendarSnapshot(); void pedirFila() }
    const aoSincronizar = () => { agendarSnapshot(); void pedirFila() }
    const aoFilaOffline = () => { void pedirFila() }
    const aoLimpar = () => { void limparPersistente() }
    const aoVisibilidade = () => { if (document.visibilityState === "visible") { agendarSnapshot(); void pedirFila() } }
    const aoRotaEstabilizada = () => { agendarSnapshot(); window.setTimeout(() => { void pedirFila() }, SNAPSHOT_AFTER_ROUTE_MS) }

    window.addEventListener("message", aoMensagem)
    window.addEventListener("online", aoOnline)
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    window.addEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)
    window.addEventListener("santa-luzia:route-settled", aoRotaEstabilizada)
    window.addEventListener(OFFLINE_DATA_EVENT, aoFilaOffline)
    window.addEventListener("santa-luzia:offline-clear", aoLimpar)
    document.addEventListener("visibilitychange", aoVisibilidade)

    if (!usaNativo) {
      iframe = document.createElement("iframe")
      iframe.src = BRIDGE_URL
      iframe.setAttribute("aria-hidden", "true")
      iframe.tabIndex = -1
      iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0"
      document.body.appendChild(iframe)
    } else {
      agendarSnapshot()
      window.setTimeout(() => { void pedirFila() }, SNAPSHOT_AFTER_ROUTE_MS)
    }

    const timer = window.setInterval(() => { agendarSnapshot(); void pedirFila() }, INTERVALO_SNAPSHOT)

    return () => {
      encerrado = true
      window.clearInterval(timer)
      if (snapshotTimer !== null) window.clearTimeout(snapshotTimer)
      window.removeEventListener("message", aoMensagem)
      window.removeEventListener("online", aoOnline)
      window.removeEventListener("santa-luzia:server-sync", aoSincronizar)
      window.removeEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)
      window.removeEventListener("santa-luzia:route-settled", aoRotaEstabilizada)
      window.removeEventListener(OFFLINE_DATA_EVENT, aoFilaOffline)
      window.removeEventListener("santa-luzia:offline-clear", aoLimpar)
      document.removeEventListener("visibilitychange", aoVisibilidade)
      iframe?.remove()
    }
  }, [liveSession])

  return null
}
