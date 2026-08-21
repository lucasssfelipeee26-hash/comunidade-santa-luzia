"use client"

import Image from "next/image"
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
  const atualizandoRef = useRef(false)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    function renderizarDistancia(valor: number, imediato = false) {
      distanciaAtual.current = valor
      if (imediato) {
        if (frame.current != null) {
          window.cancelAnimationFrame(frame.current)
          frame.current = null
        }
        setDistancia(valor)
        return
      }
      if (frame.current != null) return
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null
        setDistancia(distanciaAtual.current)
      })
    }

    function touchStart(event: TouchEvent) {
      if (atualizandoRef.current || event.touches.length !== 1 || alvoBloqueado(event.target)) return
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
        renderizarDistancia(0, true)
        return
      }

      atualizandoRef.current = true
      setAtualizando(true)
      renderizarDistancia(LIMIAR_ATUALIZAR, true)

      try {
        window.dispatchEvent(new CustomEvent("santa-luzia:manual-sync"))
        router.refresh()
        await mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true })
        emitAppFeedback("success")
      } finally {
        atualizandoRef.current = false
        distanciaAtual.current = 0
        setAtualizando(false)
        renderizarDistancia(0, true)
        window.requestAnimationFrame(() => setDistancia(0))
      }
    }

    function cancelar() {
      podePuxar.current = false
      inicioY.current = null
      renderizarDistancia(0, true)
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
  }, [router])

  const progresso = Math.min(1, distancia / LIMIAR_ATUALIZAR)
  const visivel = atualizando || distancia > 2
  const escalaLogo = 0.92 + progresso * 0.08
  const inclinacaoLogo = (progresso - 0.5) * 6
  const estiloLogo = atualizando ? undefined : { transform: `scale(${escalaLogo.toFixed(3)}) rotate(${inclinacaoLogo.toFixed(1)}deg)` }

  return (
    <div
      aria-live="polite"
      aria-hidden={!visivel}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center md:hidden"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 8px)",
        opacity: visivel ? 1 : 0,
        visibility: visivel ? "visible" : "hidden",
        transform: `translate3d(0, ${visivel ? Math.min(distancia * 0.55, 42) : -18}px, 0)`,
        transition: atualizando || distancia === 0 ? "transform 150ms ease, opacity 150ms ease, visibility 150ms" : "none",
      }}
    >
      <div className="motion2-pull-shell flex h-10 items-center gap-2 rounded-full border border-[#d4af37]/60 bg-white/95 px-3 text-[11px] font-semibold text-[#7b1326] shadow-lg backdrop-blur-md">
        <span className="motion2-pull-default">
          {atualizando ? (
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronDown
              className="size-4 transition-transform"
              style={{ transform: `rotate(${progresso >= 1 ? 180 : 0}deg)` }}
              aria-hidden="true"
            />
          )}
        </span>
        <span
          className={`motion2-pull-logo relative hidden size-7 overflow-hidden rounded-full border border-[#d4af37]/70 shadow-sm ${atualizando ? "motion2-pull-syncing" : ""}`}
          style={estiloLogo}
          aria-hidden="true"
        >
          <Image src="/images/santa-luzia-logo.jpg" alt="" fill className="object-cover" sizes="28px" />
        </span>
        <span>{atualizando ? "Atualizando Santa Luzia…" : progresso >= 1 ? "Solte para atualizar" : "Puxe para atualizar"}</span>
      </div>
      <style>{`
        .motion2-enabled .motion2-pull-default { display: none; }
        .motion2-enabled .motion2-pull-logo { display: grid; transition: transform 80ms linear, box-shadow 160ms ease; }
        .motion2-enabled .motion2-pull-shell { box-shadow: 0 10px 26px rgba(79, 42, 24, .14), 0 0 0 1px rgba(212, 175, 55, .07); }
        .motion2-enabled .motion2-pull-syncing {
          animation: motion2PullLogo 1120ms cubic-bezier(.2,.72,.22,1) infinite;
          box-shadow: 0 0 0 3px rgba(212,175,55,.12), 0 4px 12px rgba(116,73,14,.16);
        }
        @keyframes motion2PullLogo {
          0%, 100% { transform: scale(1) rotate(0deg); }
          35% { transform: scale(1.055) rotate(3deg); }
          68% { transform: scale(1.025) rotate(-2deg); }
        }
        @media (prefers-reduced-motion: reduce) { .motion2-enabled .motion2-pull-syncing { animation: none; } }
      `}</style>
    </div>
  )
}
