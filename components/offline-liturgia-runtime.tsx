"use client"

import { useEffect } from "react"

export function OfflineLiturgiaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let cancelado = false
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async () => {
      if (cancelado) return
      try {
        // Faz a primeira sincronização da Liturgia local enquanto houver conexão.
        await fetch("/api/liturgia-local", { cache: "no-store" })
      } catch {}
    }).catch(() => {})

    return () => { cancelado = true }
  }, [])

  return null
}
