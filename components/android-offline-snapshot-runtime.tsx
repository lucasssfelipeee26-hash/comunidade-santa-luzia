"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { OfflineStore } from "@/lib/native-offline-store"

type QueueItem = {
  id: string
  tipo: "atraso" | "formacao-presenca" | "quiz-liturgia"
  criadoEm?: number
  formacaoId?: string
  payload: Record<string, unknown>
}

const BRIDGE_ORIGIN = "https://localhost"
const BRIDGE_URL = `${BRIDGE_ORIGIN}/offline-bridge.html`
const TIMEOUT = 7_000

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
  useEffect(() => {
    if (!navigator.userAgent.includes("SantaLuziaAndroid") && !Capacitor.isNativePlatform()) return

    let encerrado = false
    let iframe: HTMLIFrameElement | null = null
    let bridgePronto = false
    let salvando = false
    let drenando = false
    const usaNativo = Capacitor.isPluginAvailable("OfflineStore")

    function enviarBridge(message: Record<string, unknown>) {
      if (!bridgePronto || !iframe?.contentWindow) return
      iframe.contentWindow.postMessage(message, BRIDGE_ORIGIN)
    }

    async function salvarSnapshotPersistente(snapshot: unknown) {
      const texto = JSON.stringify(snapshot)
      if (usaNativo) await OfflineStore.saveSnapshot({ snapshot: texto })
      else enviarBridge({ type: "SL_OFFLINE_SAVE_SNAPSHOT", snapshot })
    }

    async function limparPersistente() {
      if (usaNativo) await OfflineStore.clear().catch(() => undefined)
      else enviarBridge({ type: "SL_OFFLINE_CLEAR" })
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
      if (encerrado || salvando || !navigator.onLine) return
      if (!usaNativo && !bridgePronto) return
      salvando = true
      try {
        const auth = await jsonComTimeout("/api/auth/me")
        const sessao = auth?.sessao
        if (!sessao?.usuario?.id || !sessao?.tipo) {
          await limparPersistente()
          return
        }

        const [perfilResposta, perfisResposta, formacoes, ranking, escalas, biblioteca] = await Promise.all([
          jsonComTimeout("/api/perfil"),
          jsonComTimeout("/api/perfis"),
          jsonComTimeout("/api/formacoes"),
          jsonComTimeout("/api/ranking"),
          jsonComTimeout("/api/escalas"),
          jsonComTimeout("/api/biblioteca"),
        ])
        const usuario = sessao.usuario
        const perfil = perfilResposta?.perfil

        const snapshot = {
          versao: 3,
          atualizadoEm: Date.now(),
          auth: {
            sessao: {
              tipo: sessao.tipo,
              usuario: {
                id: usuario.id,
                nome: usuario.nome,
                funcao: usuario.funcao ?? null,
                desde: usuario.desde ?? null,
                foto: usuario.foto ?? null,
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
          biblioteca: biblioteca || { livros: [] },
        }

        await salvarSnapshotPersistente(snapshot)
      } finally {
        salvando = false
      }
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
      return false
    }

    async function drenarFila(items: QueueItem[]) {
      if (encerrado || drenando || !navigator.onLine || !Array.isArray(items) || !items.length) return
      drenando = true
      const restantes: QueueItem[] = []
      try {
        for (const item of items) {
          try {
            if (!(await enviarItem(item))) restantes.push(item)
          } catch {
            restantes.push(item)
          }
        }
        if (usaNativo) await salvarFila(restantes)
        else {
          const removidos = items.filter((item) => !restantes.some((r) => r.id === item.id)).map((item) => String(item.id))
          if (removidos.length) enviarBridge({ type: "SL_OFFLINE_QUEUE_REMOVE", ids: removidos })
        }
        if (restantes.length !== items.length) {
          window.dispatchEvent(new CustomEvent("santa-luzia:server-sync", { detail: { origem: "android-offline-queue", imediato: true } }))
          await salvarSnapshot()
        }
      } finally {
        drenando = false
      }
    }

    async function pedirFila() {
      if (!navigator.onLine) return
      if (usaNativo) void drenarFila(await lerFila())
      else enviarBridge({ type: "SL_OFFLINE_GET_QUEUE" })
    }

    function aoMensagem(event: MessageEvent) {
      if (event.origin !== BRIDGE_ORIGIN || usaNativo) return
      const data = event.data || {}
      if (data.type === "SL_OFFLINE_BRIDGE_READY") {
        bridgePronto = true
        void salvarSnapshot()
        void pedirFila()
      } else if (data.type === "SL_OFFLINE_QUEUE") {
        void drenarFila(Array.isArray(data.items) ? data.items : [])
      }
    }

    const aoOnline = () => { void salvarSnapshot(); void pedirFila() }
    const aoSincronizar = () => { void salvarSnapshot(); void pedirFila() }
    const aoLimpar = () => { void limparPersistente() }
    const aoVisibilidade = () => { if (document.visibilityState === "visible") { void salvarSnapshot(); void pedirFila() } }

    window.addEventListener("message", aoMensagem)
    window.addEventListener("online", aoOnline)
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    window.addEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)
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
      void salvarSnapshot()
      void pedirFila()
    }

    const timer = window.setInterval(() => { void salvarSnapshot(); void pedirFila() }, 90_000)

    return () => {
      encerrado = true
      window.clearInterval(timer)
      window.removeEventListener("message", aoMensagem)
      window.removeEventListener("online", aoOnline)
      window.removeEventListener("santa-luzia:server-sync", aoSincronizar)
      window.removeEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)
      window.removeEventListener("santa-luzia:offline-clear", aoLimpar)
      document.removeEventListener("visibilitychange", aoVisibilidade)
      iframe?.remove()
    }
  }, [])

  return null
}
