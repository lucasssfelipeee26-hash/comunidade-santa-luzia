"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const SHOW_AFTER_MS = 420

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rotaAtual = `${pathname}?${searchParams.toString()}`
  const [visivel, setVisivel] = useState(false)
  const mostrar = useRef<number | null>(null)
  const emTransicao = useRef(false)

  function limpar() {
    if (mostrar.current !== null) window.clearTimeout(mostrar.current)
    mostrar.current = null
  }

  function iniciar() {
    limpar()
    emTransicao.current = true
    // Rotas locais rápidas não precisam de nenhum desenho intermediário. A barra só
    // aparece quando a navegação realmente demora, evitando re-render a cada 120 ms.
    mostrar.current = window.setTimeout(() => {
      mostrar.current = null
      if (emTransicao.current) setVisivel(true)
    }, SHOW_AFTER_MS)
  }

  function finalizar() {
    emTransicao.current = false
    limpar()
    setVisivel(false)
  }

  useEffect(() => {
    const aoIniciar = () => iniciar()
    const aoVoltarOuAvancar = () => iniciar()
    window.addEventListener("santa-luzia:route-start", aoIniciar)
    window.addEventListener("popstate", aoVoltarOuAvancar)
    return () => {
      limpar()
      window.removeEventListener("santa-luzia:route-start", aoIniciar)
      window.removeEventListener("popstate", aoVoltarOuAvancar)
    }
  }, [])

  useEffect(() => {
    if (emTransicao.current) finalizar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotaAtual])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-2 top-[max(8px,env(safe-area-inset-top))] z-[9999] h-1 overflow-hidden rounded-full bg-primary/10 shadow-[0_1px_7px_rgba(82,17,35,.16)] ${visivel ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="h-full w-full rounded-full shadow-[0_0_10px_rgba(212,175,55,.8)]"
        style={{ background: "linear-gradient(90deg, var(--site-deep), var(--site-main), var(--site-gold), var(--site-gold-light), var(--site-main))" }}
      />
    </div>
  )
}
