"use client"

import { useEffect } from "react"

type QueueItem = {
  id: string
  tipo: "atraso" | "formacao-presenca"
  criadoEm: number
  formacaoId?: string
  payload: Record<string, unknown>
}

const BRIDGE_ORIGIN = "https://localhost"
const BRIDGE_URL = `${BRIDGE_ORIGIN}/offline-bridge.html`
const TIMEOUT = 6_000

async function jsonComTimeout(url: string) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
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
    if (!navigator.userAgent.includes("SantaLuziaAndroid")) return

    let encerrado = false
    let iframe: HTMLIFrameElement | null = null
    let pronto = false
    let salvando = false
    let drenando = false

    function enviar(message: Record<string, unknown>) {
      if (!pronto || !iframe?.contentWindow) return
      iframe.contentWindow.postMessage(message, BRIDGE_ORIGIN)
    }

    async function salvarSnapshot() {
      if (encerrado || salvando || !pronto || !navigator.onLine) return
      salvando = true
      try {
        const auth = await jsonComTimeout("/api/auth/me")
        const sessao = auth?.sessao
        if (!sessao?.usuario?.id || !sessao?.tipo) {
          enviar({ type: "SL_OFFLINE_CLEAR" })
          return
        }

        const usuarioId = String(sessao.usuario.id)
        const moderador = sessao.tipo === "moderador"
        const [perfil, formacoes, ranking, escalas, notificacoes, membros, equipe] = await Promise.all([
          moderador ? Promise.resolve(null) : jsonComTimeout(`/api/membros/${encodeURIComponent(usuarioId)}`),
          jsonComTimeout("/api/formacoes"),
          jsonComTimeout("/api/ranking"),
          jsonComTimeout("/api/escalas"),
          jsonComTimeout("/api/notificacoes"),
          moderador ? jsonComTimeout("/api/membros") : Promise.resolve(null),
          moderador ? jsonComTimeout("/api/equipe") : Promise.resolve(null),
        ])

        enviar({
          type: "SL_OFFLINE_SAVE_SNAPSHOT",
          snapshot: {
            versao: 1,
            atualizadoEm: Date.now(),
            auth,
            perfil,
            formacoes,
            ranking,
            escalas,
            notificacoes,
            membros,
            equipe,
          },
        })
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

      return false
    }

    async function drenarFila(items: QueueItem[]) {
      if (encerrado || drenando || !navigator.onLine || !Array.isArray(items) || !items.length) return
      drenando = true
      const removidos: string[] = []
      try {
        for (const item of items) {
          try {
            if (await enviarItem(item)) removidos.push(String(item.id))
          } catch {
            break
          }
        }
        if (removidos.length) {
          enviar({ type: "SL_OFFLINE_QUEUE_REMOVE", ids: removidos })
          window.dispatchEvent(new CustomEvent("santa-luzia:server-sync", { detail: { origem: "android-offline-queue", imediato: true } }))
          await salvarSnapshot()
        }
      } finally {
        drenando = false
      }
    }

    function pedirFila() {
      if (!navigator.onLine) return
      enviar({ type: "SL_OFFLINE_GET_QUEUE" })
    }

    function aoMensagem(event: MessageEvent) {
      if (event.origin !== BRIDGE_ORIGIN) return
      const data = event.data || {}
      if (data.type === "SL_OFFLINE_BRIDGE_READY") {
        pronto = true
        void salvarSnapshot()
        pedirFila()
        return
      }
      if (data.type === "SL_OFFLINE_QUEUE") {
        void drenarFila(Array.isArray(data.items) ? data.items : [])
      }
    }

    function aoOnline() {
      void salvarSnapshot()
      pedirFila()
    }

    function aoSincronizar() {
      void salvarSnapshot()
      pedirFila()
    }

    function aoLimpar() {
      enviar({ type: "SL_OFFLINE_CLEAR" })
    }

    function aoVisibilidade() {
      if (document.visibilityState !== "visible") return
      void salvarSnapshot()
      pedirFila()
    }

    window.addEventListener("message", aoMensagem)
    window.addEventListener("online", aoOnline)
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    window.addEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)
    window.addEventListener("santa-luzia:offline-clear", aoLimpar)
    document.addEventListener("visibilitychange", aoVisibilidade)

    iframe = document.createElement("iframe")
    iframe.src = BRIDGE_URL
    iframe.setAttribute("aria-hidden", "true")
    iframe.tabIndex = -1
    iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0"
    document.body.appendChild(iframe)

    const timer = window.setInterval(() => {
      void salvarSnapshot()
      pedirFila()
    }, 60_000)

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
      iframe = null
    }
  }, [])

  return null
}
