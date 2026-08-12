"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { mutate } from "swr"
import { ChevronDown, RefreshCw } from "lucide-react"
import { emitAppFeedback } from "@/lib/sound-preferences"

const LIMIAR_ATUALIZAR = 64
const MAX_DISTANCIA = 88

function alvoBloqueado(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [data-no-pull-refresh]"),
  )
}

export function PullToRefresh() {
  const router = useRouter()
  const [distancia, setDistancia] = useState(0)
  const [atualizando, setAtualizando] = useState(false)
  const inicioY = useRef<number | null>(null)
  const distanciaAtual = useRef(0)
  const podePuxar = useRef(false)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    function renderizarDistancia(valor: number) {
      distanciaAtual.current = valor
      if (frame.current != null) return
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null
        setDistancia(distanciaAtual.current)
      })
    }

    function touchStart(event: TouchEvent) {
      if (atualizando || event.touches.length !== 1 || alvoBloqueado(event.target)) return
      if (window.scrollY > 1) return

      inicioY.current = event.touches[0].clientY
      distanciaAtual.current = 0
      podePuxar.current = true
    }

    function touchMove(event: TouchEvent) {
      if (!podePuxar.current || inicioY.current == null || event.touches.length !== 1) return

      const delta = event.touches[0].clientY - inicioY.current
      if (delta <= 0 || window.scrollY > 1) {
        renderizarDistancia(0)
        return
      }

      const suavizada = Math.min(MAX_DISTANCIA, Math.round(delta * 0.48))
      renderizarDistancia(suavizada)

      if (delta > 8) event.preventDefault()
    }

    async function finalizar() {
      const deveAtualizar = podePuxar.current && distanciaAtual.current >= LIMIAR_ATUALIZAR
      podePuxar.current = false
      inicioY.current = null

      if (!deveAtualizar) {
        renderizarDistancia(0)
        return
      }

      setAtualizando(true)
      renderizarDistancia(LIMIAR_ATUALIZAR)

      try {
        router.refresh()
        await mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true })
        await new Promise((resolve) => window.setTimeout(resolve, 280))
        emitAppFeedback("success")
      } finally {
        renderizarDistancia(0)
        setAtualizando(false)
      }
    }

    function cancelar() {
      podePuxar.current = false
      inicioY.current = null
      renderizarDistancia(0)
    }

    document.addEventListener("touchstart", touchStart, { passive: true })
    document.addEventListener("touchmove", touchMove, { passive: false })
    document.addEventListener("touchend", finalizar, { passive: true })
    document.addEventListener("touchcancel", cancelar, { passive: true })

    return () => {
      document.removeEventListener("touchstart", touchStart)
      document.removeEventListener("touchmove", touchMove)
      document.removeEventListener("touchend", finalizar)
      document.removeEventListener("touchcancel", cancelar)
      if (frame.current != null) window.cancelAnimationFrame(frame.current)
    }
  }, [atualizando, router])

  const progresso = Math.min(1, distancia / LIMIAR_ATUALIZAR)
  const visivel = distancia > 2 || atualizando

  return (
    <div
      aria-live="polite"
      aria-hidden={!visivel}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center md:hidden"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 8px)",
        opacity: visivel ? 1 : 0,
        transform: `translate3d(0, ${visivel ? Math.min(distancia * 0.55, 42) : -16}px, 0)`,
        transition: atualizando || distancia === 0 ? "transform 160ms ease, opacity 160ms ease" : "none",
      }}
    >
      <div className="flex h-10 items-center gap-2 rounded-full border border-[#d4af37]/60 bg-white px-3 text-[11px] font-semibold text-[#7b1326] shadow-lg">
        {atualizando ? (
          <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown
            className="size-4 transition-transform"
            style={{ transform: `rotate(${progresso >= 1 ? 180 : 0}deg)` }}
            aria-hidden="true"
          />
        )}
        <span>{atualizando ? "Atualizando…" : progresso >= 1 ? "Solte para atualizar" : "Puxe para atualizar"}</span>
      </div>
    </div>
  )
}
