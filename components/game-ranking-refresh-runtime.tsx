"use client"

import { useEffect } from "react"

const ENDPOINT_RESULTADO = "/api/jogo/caminho-da-luz/resultado"

export function GameRankingRefreshRuntime() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return

    let ultimaEmissao = 0
    const observer = new PerformanceObserver((lista) => {
      for (const entry of lista.getEntries()) {
        try {
          const url = new URL(entry.name, window.location.origin)
          if (url.origin !== window.location.origin || url.pathname !== ENDPOINT_RESULTADO) continue
          const agora = Date.now()
          if (agora - ultimaEmissao < 250) continue
          ultimaEmissao = agora
          window.dispatchEvent(new CustomEvent("santa-luzia:server-sync", {
            detail: { origem: "missao-do-altar", imediato: true },
          }))
        } catch {}
      }
    })

    try {
      observer.observe({ type: "resource", buffered: false })
    } catch {
      observer.disconnect()
      return
    }

    return () => observer.disconnect()
  }, [])

  return null
}
