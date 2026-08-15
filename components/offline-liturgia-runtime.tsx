"use client"

import { useEffect } from "react"

export function OfflineLiturgiaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let cancelado = false

    const aquecerPrivado = () => {
      if (cancelado || !navigator.onLine) return
      const controller = navigator.serviceWorker.controller
      if (controller) controller.postMessage({ tipo: "AQUECER_CACHE_PRIVADO" })
    }

    const aoMudarController = () => {
      window.setTimeout(aquecerPrivado, 150)
    }

    const aoVoltarInternet = () => {
      aquecerPrivado()
    }

    const aoCliqueOffline = (event: MouseEvent) => {
      const semRede = !navigator.onLine || document.documentElement.dataset.syncState === "offline"
      if (!semRede || event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const alvo = event.target
      if (!(alvo instanceof Element)) return
      const link = alvo.closest("a[href]") as HTMLAnchorElement | null
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return

      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || (url.hash && url.pathname === window.location.pathname)) return

      event.preventDefault()
      event.stopPropagation()
      window.location.assign(`${url.pathname}${url.search}${url.hash}`)
    }

    navigator.serviceWorker.addEventListener("controllerchange", aoMudarController)
    window.addEventListener("online", aoVoltarInternet)
    document.addEventListener("click", aoCliqueOffline, true)

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (registration) => {
      if (cancelado) return
      try {
        await registration.update()
      } catch {}
      try {
        // Faz a primeira sincronização da Liturgia local enquanto houver conexão.
        await fetch("/api/liturgia-local", { cache: "no-store" })
      } catch {}
      try {
        await navigator.serviceWorker.ready
      } catch {}
      aquecerPrivado()
      window.setTimeout(aquecerPrivado, 1200)
    }).catch(() => {})

    return () => {
      cancelado = true
      navigator.serviceWorker.removeEventListener("controllerchange", aoMudarController)
      window.removeEventListener("online", aoVoltarInternet)
      document.removeEventListener("click", aoCliqueOffline, true)
    }
  }, [])

  return null
}
