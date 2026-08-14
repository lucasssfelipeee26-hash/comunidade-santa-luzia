"use client"

import { useEffect } from "react"
import { useSWRConfig } from "swr"
import { salvarCacheEscalas, sincronizarRelatosAtrasoPendentes } from "@/lib/offline-data"

type ServerStatus = {
  ok: boolean
  appRelease?: string
  revisaoDados: string
  revisaoTema?: string
  servidorEm: number
}

const REVISAO_KEY = "santa-luzia:ultima-revisao-servidor"
const ULTIMA_SYNC_KEY = "santa-luzia:ultima-sincronizacao"
const TEMA_KEY = "santa-luzia:ultima-revisao-tema"
const RELEASE_KEY = "santa-luzia:release-visto"

function definirEstado(estado: "online" | "offline" | "sincronizando") {
  document.documentElement.dataset.syncState = estado
}

export function ServerSyncRuntime() {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    let encerrado = false
    let emAndamento = false

    async function sincronizar(forcarRevalidacao = false) {
      if (encerrado || emAndamento) return

      if (!navigator.onLine) {
        definirEstado("offline")
        return
      }

      emAndamento = true
      definirEstado("sincronizando")

      try {
        const sincronizacaoLocal = Promise.all([
          sincronizarRelatosAtrasoPendentes().catch(() => ({ enviados: 0, restantes: 0 })),
          fetch("/api/escalas", { cache: "no-store", credentials: "same-origin" })
            .then(async (res) => {
              if (!res.ok) return false
              const json = await res.json()
              return json?.ok ? salvarCacheEscalas(json) : false
            })
            .catch(() => false),
        ])

        const response = await fetch("/api/app/status", {
          cache: "no-store",
          credentials: "same-origin",
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const status = (await response.json()) as ServerStatus
        if (!status.ok || !status.revisaoDados) throw new Error("Status inválido")

        const releaseAnterior = localStorage.getItem(RELEASE_KEY)
        if (status.appRelease) {
          localStorage.setItem(RELEASE_KEY, status.appRelease)
        }

        const [relatos] = await sincronizacaoLocal

        const anterior = localStorage.getItem(REVISAO_KEY)
        const temaAnterior = localStorage.getItem(TEMA_KEY)
        const mudou = Boolean(anterior && anterior !== status.revisaoDados)
        const temaMudou = Boolean(status.revisaoTema && temaAnterior && temaAnterior !== status.revisaoTema)

        localStorage.setItem(REVISAO_KEY, status.revisaoDados)
        if (status.revisaoTema) localStorage.setItem(TEMA_KEY, status.revisaoTema)
        localStorage.setItem(ULTIMA_SYNC_KEY, String(Date.now()))
        definirEstado("online")

        if (temaMudou) {
          window.location.reload()
          return
        }

        if (mudou || forcarRevalidacao || relatos.enviados > 0 || Boolean(releaseAnterior && releaseAnterior !== status.appRelease)) {
          await mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith("/api/") &&
              key !== "/api/app/status",
            undefined,
            { revalidate: true },
          )
          window.dispatchEvent(new CustomEvent("santa-luzia:server-sync"))
        }
      } catch {
        definirEstado("offline")
      } finally {
        emAndamento = false
      }
    }

    const aoVoltarInternet = () => void sincronizar(true)
    const aoPerderInternet = () => definirEstado("offline")
    const aoVisibilidade = () => {
      if (document.visibilityState === "visible") void sincronizar(true)
    }

    window.addEventListener("online", aoVoltarInternet)
    window.addEventListener("offline", aoPerderInternet)
    document.addEventListener("visibilitychange", aoVisibilidade)

    void sincronizar(false)
    const timer = window.setInterval(() => void sincronizar(false), 60_000)

    return () => {
      encerrado = true
      window.clearInterval(timer)
      window.removeEventListener("online", aoVoltarInternet)
      window.removeEventListener("offline", aoPerderInternet)
      document.removeEventListener("visibilitychange", aoVisibilidade)
    }
  }, [mutate])

  return null
}
