"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { OfflineStore } from "@/lib/native-offline-store"

type QueueItem = {
  id: string
  tipo: "formacao-presenca" | "atraso"
  formacaoId?: string
  payload?: Record<string, unknown>
}

const TIMEOUT = 7_000

async function fetchJson(url: string) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } finally {
    window.clearTimeout(timer)
  }
}

async function sincronizarFilaNativa() {
  const carregada = await OfflineStore.loadQueue().catch(() => ({ queue: "[]" }))
  let itens: QueueItem[] = []
  try {
    const parsed = JSON.parse(carregada.queue || "[]")
    itens = Array.isArray(parsed) ? parsed : []
  } catch {}
  if (!itens.length) return

  const restantes: QueueItem[] = []
  for (const item of itens) {
    try {
      if (item.tipo === "formacao-presenca" && item.formacaoId && item.payload) {
        const response = await fetch(`/api/formacoes/${encodeURIComponent(item.formacaoId)}/minha-presenca`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(item.payload),
        })
        if (!response.ok) throw new Error("presenca")
        continue
      }
      if (item.tipo === "atraso" && item.payload) {
        const response = await fetch("/api/ranking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(item.payload),
        })
        if (!response.ok) throw new Error("atraso")
        continue
      }
      restantes.push(item)
    } catch {
      restantes.push(item)
    }
  }
  await OfflineStore.saveQueue({ queue: JSON.stringify(restantes) }).catch(() => undefined)
}

export function NativeOfflineSnapshotRuntime() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("OfflineStore")) return

    let cancelado = false
    let sincronizando = false
    let timer: number | undefined

    async function sincronizar() {
      if (cancelado || sincronizando || !navigator.onLine) return
      sincronizando = true
      try {
        await sincronizarFilaNativa()

        const auth = await fetchJson("/api/auth/me")
        const sessao = auth?.sessao
        if (!sessao?.usuario?.id || !sessao?.tipo) return

        const [perfilResposta, perfis, formacoes, ranking, escalas] = await Promise.all([
          fetchJson("/api/perfil"),
          fetchJson("/api/perfis"),
          fetchJson("/api/formacoes"),
          fetchJson("/api/ranking"),
          fetchJson("/api/escalas"),
        ])
        if (cancelado) return

        const usuario = sessao.usuario
        const snapshot = {
          versao: 2,
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
          perfil: perfilResposta?.perfil ? {
            id: perfilResposta.perfil.id,
            nome: perfilResposta.perfil.nome,
            funcao: perfilResposta.perfil.funcao,
            desde: perfilResposta.perfil.desde,
            foto: perfilResposta.perfil.foto ?? null,
            bio: perfilResposta.perfil.bio ?? "",
          } : null,
          perfis: Array.isArray(perfis?.perfis) ? perfis.perfis : [],
          formacoes: formacoes || { formacoes: [] },
          ranking: ranking ? {
            eu: ranking.eu,
            ranking: ranking.ranking || [],
            membros: ranking.membros || [],
            ocorrencias: ranking.ocorrencias || [],
          } : { ranking: [], membros: [], ocorrencias: [] },
          escalas: escalas || { escalas: [] },
        }

        await OfflineStore.saveSnapshot({ snapshot: JSON.stringify(snapshot) })
        try { localStorage.setItem("santa-luzia:nativo-offline:ultima-sincronizacao", String(snapshot.atualizadoEm)) } catch {}
        window.dispatchEvent(new CustomEvent("santa-luzia:native-offline-ready", { detail: { atualizadoEm: snapshot.atualizadoEm } }))
      } catch {
        // O snapshot anterior permanece intacto quando a rede falha.
      } finally {
        sincronizando = false
      }
    }

    const aoOnline = () => void sincronizar()
    const aoServerSync = () => void sincronizar()
    const aoVisibilidade = () => { if (document.visibilityState === "visible") void sincronizar() }
    window.addEventListener("online", aoOnline)
    window.addEventListener("santa-luzia:server-sync", aoServerSync)
    document.addEventListener("visibilitychange", aoVisibilidade)
    void sincronizar()
    timer = window.setInterval(() => void sincronizar(), 90_000)

    return () => {
      cancelado = true
      if (timer) window.clearInterval(timer)
      window.removeEventListener("online", aoOnline)
      window.removeEventListener("santa-luzia:server-sync", aoServerSync)
      document.removeEventListener("visibilitychange", aoVisibilidade)
    }
  }, [])

  return null
}
