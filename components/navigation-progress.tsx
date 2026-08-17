"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

const EVENTO_FIM = "santa-luzia:navigation-complete"

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
  const [visivel, setVisivel] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const intervalo = useRef<number | null>(null)
  const fallback = useRef<number | null>(null)

  function limparTimers() {
    if (intervalo.current !== null) window.clearInterval(intervalo.current)
    if (fallback.current !== null) window.clearTimeout(fallback.current)
    intervalo.current = null
    fallback.current = null
  }

  function iniciar() {
    limparTimers()
    setVisivel(true)
    setProgresso(8)

    intervalo.current = window.setInterval(() => {
      setProgresso((atual) => {
        if (atual >= 88) return atual
        const passo = atual < 35 ? 13 : atual < 65 ? 7 : 2.5
        return Math.min(88, atual + passo)
      })
    }, 140)

    fallback.current = window.setTimeout(() => finalizar(), 12_000)
  }

  function finalizar() {
    limparTimers()
    setProgresso(100)
    window.setTimeout(() => {
      setVisivel(false)
      setProgresso(0)
    }, 220)
  }

  useEffect(() => {
    const aoClicar = (evento: MouseEvent) => {
      if (linkInternoValido(evento)) iniciar()
    }
    const aoVoltarOuAvancar = () => iniciar()
    const aoConcluir = () => finalizar()

    document.addEventListener("click", aoClicar, true)
    window.addEventListener("popstate", aoVoltarOuAvancar)
    window.addEventListener(EVENTO_FIM, aoConcluir)

    const originalPush = history.pushState.bind(history)
    const originalReplace = history.replaceState.bind(history)

    history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPush(...args)
      window.dispatchEvent(new Event(EVENTO_FIM))
    }) as History["pushState"]

    history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      originalReplace(...args)
      window.dispatchEvent(new Event(EVENTO_FIM))
    }) as History["replaceState"]

    return () => {
      limparTimers()
      document.removeEventListener("click", aoClicar, true)
      window.removeEventListener("popstate", aoVoltarOuAvancar)
      window.removeEventListener(EVENTO_FIM, aoConcluir)
      history.pushState = originalPush
      history.replaceState = originalReplace
    }
  }, [])

  useEffect(() => {
    if (visivel) finalizar()
    // A mudança de pathname é a confirmação mais confiável de que a nova tela entrou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden transition-opacity duration-200 ${visivel ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="santa-luzia-navigation-progress h-full rounded-r-full shadow-[0_0_8px_rgba(212,175,55,.65)] transition-[width] duration-150 ease-out"
        style={{ width: `${progresso}%` }}
      />
    </div>
  )
}
