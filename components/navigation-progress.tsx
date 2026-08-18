"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

function linkInternoValido(evento: MouseEvent) {
  if (evento.defaultPrevented || evento.button !== 0) return false
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return false

  const alvo = evento.target as Element | null
  const link = alvo?.closest("a[href]") as HTMLAnchorElement | null
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return false

  const href = link.getAttribute("href") || ""
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false

  try {
    const destino = new URL(link.href, window.location.href)
    if (destino.origin !== window.location.origin) return false
    const atual = new URL(window.location.href)
    return `${destino.pathname}${destino.search}${destino.hash}` !== `${atual.pathname}${atual.search}${atual.hash}`
  } catch {
    return false
  }
}

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rotaAtual = `${pathname}?${searchParams.toString()}`
  const [visivel, setVisivel] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const intervalo = useRef<number | null>(null)
  const fallback = useRef<number | null>(null)
  const ocultar = useRef<number | null>(null)

  function limparTimers() {
    if (intervalo.current !== null) window.clearInterval(intervalo.current)
    if (fallback.current !== null) window.clearTimeout(fallback.current)
    if (ocultar.current !== null) window.clearTimeout(ocultar.current)
    intervalo.current = null
    fallback.current = null
    ocultar.current = null
  }

  function iniciar() {
    limparTimers()
    setVisivel(true)
    setProgresso(7)

    intervalo.current = window.setInterval(() => {
      setProgresso((atual) => {
        if (atual >= 90) return atual
        const passo = atual < 30 ? 12 : atual < 60 ? 6 : atual < 80 ? 3 : 1.2
        return Math.min(90, atual + passo)
      })
    }, 120)

    fallback.current = window.setTimeout(() => finalizar(), 10_000)
  }

  function finalizar() {
    if (intervalo.current !== null) window.clearInterval(intervalo.current)
    if (fallback.current !== null) window.clearTimeout(fallback.current)
    intervalo.current = null
    fallback.current = null
    setProgresso(100)
    ocultar.current = window.setTimeout(() => {
      setVisivel(false)
      setProgresso(0)
      ocultar.current = null
    }, 240)
  }

  useEffect(() => {
    const aoClicar = (evento: MouseEvent) => {
      if (linkInternoValido(evento)) iniciar()
    }
    const aoVoltarOuAvancar = () => iniciar()
    const aoTrocarDocumento = () => iniciar()

    document.addEventListener("click", aoClicar, true)
    window.addEventListener("popstate", aoVoltarOuAvancar)
    window.addEventListener("beforeunload", aoTrocarDocumento)

    return () => {
      limparTimers()
      document.removeEventListener("click", aoClicar, true)
      window.removeEventListener("popstate", aoVoltarOuAvancar)
      window.removeEventListener("beforeunload", aoTrocarDocumento)
    }
  }, [])

  useEffect(() => {
    if (visivel) finalizar()
    // A mudança de rota confirma que a nova página entrou, inclusive em navegação offline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotaAtual])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-2 top-[max(8px,env(safe-area-inset-top))] z-[9999] h-1 overflow-hidden rounded-full bg-primary/10 shadow-[0_1px_7px_rgba(82,17,35,.16)] transition-opacity duration-200 ${visivel ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="h-full rounded-full shadow-[0_0_10px_rgba(212,175,55,.8)] transition-[width] duration-150 ease-out"
        style={{
          width: `${progresso}%`,
          background: "linear-gradient(90deg, var(--site-deep), var(--site-main), var(--site-gold), var(--site-gold-light), var(--site-main))",
        }}
      />
    </div>
  )
}
