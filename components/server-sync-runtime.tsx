"use client"

import { useEffect } from "react"
import { useSWRConfig } from "swr"
import { Capacitor } from "@capacitor/core"
import {
  salvarCacheEscalas,
  salvarCacheFormacoes,
  sincronizarPresencasFormacaoPendentes,
  sincronizarRelatosAtrasoPendentes,
} from "@/lib/offline-data"

type ServerStatus = {
  ok: boolean
  appRelease?: string
  android?: {
    available: boolean
    versionCode: number
    versionName: string
    required: boolean
    highlights: string[]
    downloadUrl: string
    apkSize: number
    apkSha256: string
  }
  revisaoDados: string
  revisaoTema?: string
  servidorEm: number
}

const REVISAO_KEY = "santa-luzia:ultima-revisao-servidor"
const ULTIMA_SYNC_KEY = "santa-luzia:ultima-sincronizacao"
const TEMA_KEY = "santa-luzia:ultima-revisao-tema"
const RELEASE_KEY = "santa-luzia:release-visto"
const ULTIMA_COMPLETA_KEY = "santa-luzia:ultima-sincronizacao-completa"
const INTERVALO_STATUS = 60_000
const INTERVALO_COMPLETO = 15 * 60_000
const TIMEOUT_REQUISICAO = 6_500

function lerLocal(chave: string) {
  try { return window.localStorage.getItem(chave) } catch { return null }
}

function salvarLocal(chave: string, valor: string) {
  try { window.localStorage.setItem(chave, valor); return true } catch { return false }
}

function definirEstado(estado: "online" | "offline" | "sincronizando") {
  document.documentElement.dataset.syncState = estado
}

async function fetchComTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_REQUISICAO)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

async function comLimite<T>(promessa: Promise<T>, fallback: T): Promise<T> {
  let timer = 0
  try {
    return await Promise.race([
      promessa.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = window.setTimeout(() => resolve(fallback), TIMEOUT_REQUISICAO)
      }),
    ])
  } finally {
    if (timer) window.clearTimeout(timer)
  }
}

export function ServerSyncRuntime() {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    let encerrado = false
    let emAndamento = false
    let forcarPendente = false
    let ultimaCompleta = Number(lerLocal(ULTIMA_COMPLETA_KEY) || 0)
    let redeNativa: boolean | null = null
    const listenersNativos: Array<{ remove: () => Promise<void> }> = []

    const estaConectado = () => redeNativa ?? navigator.onLine

    async function sincronizar(forcarRevalidacao = false) {
      if (encerrado) return
      if (emAndamento) {
        forcarPendente ||= forcarRevalidacao
        return
      }

      if (!estaConectado()) {
        definirEstado("offline")
        return
      }

      emAndamento = true
      definirEstado("sincronizando")

      try {
        const response = await fetchComTimeout(`/api/app/status?sync=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const status = (await response.json()) as ServerStatus
        if (!status.ok || !status.revisaoDados) throw new Error("Status inválido")

        const anterior = lerLocal(REVISAO_KEY)
        const temaAnterior = lerLocal(TEMA_KEY)
        const releaseAnterior = lerLocal(RELEASE_KEY)
        const primeiraSincronizacao = !anterior
        const mudou = Boolean(anterior && anterior !== status.revisaoDados)
        const temaMudou = Boolean(status.revisaoTema && temaAnterior && temaAnterior !== status.revisaoTema)
        const agora = Date.now()
        const precisaCompleta =
          primeiraSincronizacao ||
          mudou ||
          agora - ultimaCompleta >= INTERVALO_COMPLETO

        salvarLocal(REVISAO_KEY, status.revisaoDados)
        if (status.revisaoTema) salvarLocal(TEMA_KEY, status.revisaoTema)
        if (status.appRelease) salvarLocal(RELEASE_KEY, status.appRelease)
        salvarLocal(ULTIMA_SYNC_KEY, String(agora))
        definirEstado("online")
        window.dispatchEvent(new CustomEvent("santa-luzia:app-status", { detail: status }))

        if (temaMudou) {
          window.location.reload()
          return
        }

        let relatos = { enviados: 0, restantes: 0 }
        let presencasFormacao = { enviados: 0, restantes: 0 }

        if (precisaCompleta) {
          ultimaCompleta = agora
          salvarLocal(ULTIMA_COMPLETA_KEY, String(agora))
          const resultados = await Promise.all([
            comLimite(sincronizarRelatosAtrasoPendentes(), relatos),
            comLimite(sincronizarPresencasFormacaoPendentes(), presencasFormacao),
            fetchComTimeout("/api/escalas", { cache: "no-store", credentials: "same-origin" })
              .then(async (res) => {
                if (!res.ok) return false
                const json = await res.json()
                return json?.ok ? salvarCacheEscalas(json) : false
              })
              .catch(() => false),
            fetchComTimeout("/api/formacoes", { cache: "no-store", credentials: "same-origin" })
              .then(async (res) => {
                if (!res.ok) return false
                const json = await res.json()
                return Array.isArray(json?.formacoes) ? salvarCacheFormacoes(json) : false
              })
              .catch(() => false),
          ])
          relatos = resultados[0]
          presencasFormacao = resultados[1]
        }

        const releaseMudou = Boolean(releaseAnterior && releaseAnterior !== status.appRelease)
        if (
          mudou ||
          primeiraSincronizacao ||
          relatos.enviados > 0 ||
          presencasFormacao.enviados > 0 ||
          releaseMudou
        ) {
          void mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith("/api/") &&
              key !== "/api/app/status",
            undefined,
            { revalidate: true },
          )
          window.dispatchEvent(new CustomEvent("santa-luzia:server-sync", {
            detail: { revisaoDados: status.revisaoDados, mudou, forcarRevalidacao },
          }))
        }
      } catch {
        definirEstado("offline")
      } finally {
        emAndamento = false
        if (forcarPendente && !encerrado) {
          forcarPendente = false
          window.setTimeout(() => void sincronizar(true), 80)
        }
      }
    }

    const aoVoltarInternet = () => {
      if (redeNativa !== false) void sincronizar(true)
    }
    const aoPerderInternet = () => {
      if (redeNativa !== true) definirEstado("offline")
    }
    const aoVisibilidade = () => {
      if (document.visibilityState !== "visible") return
      const ultima = Number(lerLocal(ULTIMA_SYNC_KEY) || 0)
      void sincronizar(Date.now() - ultima > INTERVALO_STATUS)
    }

    const aoSincronizacaoManual = () => { void sincronizar(true) }

    window.addEventListener("online", aoVoltarInternet)
    window.addEventListener("offline", aoPerderInternet)
    window.addEventListener("santa-luzia:manual-sync", aoSincronizacaoManual)
    document.addEventListener("visibilitychange", aoVisibilidade)

    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const { Network } = await import("@capacitor/network")
          const inicial = await Network.getStatus()
          if (encerrado) return
          redeNativa = inicial.connected
          definirEstado(inicial.connected ? "online" : "offline")
          if (inicial.connected) void sincronizar(true)
          const networkHandle = await Network.addListener("networkStatusChange", (status) => {
            if (encerrado) return
            redeNativa = status.connected
            definirEstado(status.connected ? "online" : "offline")
            if (status.connected) void sincronizar(true)
          })
          if (encerrado) await networkHandle.remove()
          else listenersNativos.push(networkHandle)
        } catch {
          redeNativa = null
        }

        try {
          const { App } = await import("@capacitor/app")
          const appHandle = await App.addListener("appStateChange", ({ isActive }) => {
            if (!encerrado && isActive) void sincronizar(true)
          })
          if (encerrado) await appHandle.remove()
          else listenersNativos.push(appHandle)
        } catch {
          // visibilitychange permanece como fallback.
        }
      })()
    }

    void sincronizar(true)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sincronizar(false)
    }, INTERVALO_STATUS)

    return () => {
      encerrado = true
      window.clearInterval(timer)
      window.removeEventListener("online", aoVoltarInternet)
      window.removeEventListener("offline", aoPerderInternet)
      window.removeEventListener("santa-luzia:manual-sync", aoSincronizacaoManual)
      document.removeEventListener("visibilitychange", aoVisibilidade)
      listenersNativos.forEach((handle) => { void handle.remove() })
    }
  }, [mutate])

  return null
}
