"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rotaAtual = `${pathname}?${searchParams.toString()}`
  const [visivel, setVisivel] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const intervalo = useRef<number | null>(null)
  const fallback = useRef<number | null>(null)
  const ocultar = useRef<number | null>(null)
  const mostrar = useRef<number | null>(null)
  const emTransicao = useRef(false)

  function limparTimers() {
    if (intervalo.current !== null) window.clearInterval(intervalo.current)
    if (fallback.current !== null) window.clearTimeout(fallback.current)
    if (ocultar.current !== null) window.clearTimeout(ocultar.current)
    if (mostrar.current !== null) window.clearTimeout(mostrar.current)
    intervalo.current = null
    fallback.current = null
    ocultar.current = null
    mostrar.current = null
  }

  function iniciar() {
    limparTimers()
    emTransicao.current = true
    setProgresso(7)

    // A navegação local costuma concluir em poucos frames. Esperar um pouco
    // impede que a barra apareça e suma imediatamente, efeito percebido como piscada.
    mostrar.current = window.setTimeout(() => {
      mostrar.current = null
      if (emTransicao.current) setVisivel(true)
    }, 140)

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
    emTransicao.current = false
    if (intervalo.current !== null) window.clearInterval(intervalo.current)
    if (fallback.current !== null) window.clearTimeout(fallback.current)
    if (mostrar.current !== null) window.clearTimeout(mostrar.current)
    intervalo.current = null
    fallback.current = null
    mostrar.current = null

    setProgresso(100)
    ocultar.current = window.setTimeout(() => {
      setVisivel(false)
      setProgresso(0)
      ocultar.current = null
    }, visivel ? 180 : 0)
  }

  useEffect(() => {
    const aoIniciar = () => iniciar()
    const aoVoltarOuAvancar = () => iniciar()

    window.addEventListener("santa-luzia:route-start", aoIniciar)
    window.addEventListener("popstate", aoVoltarOuAvancar)

    return () => {
      limparTimers()
      window.removeEventListener("santa-luzia:route-start", aoIniciar)
      window.removeEventListener("popstate", aoVoltarOuAvancar)
    }
  }, [])

  useEffect(() => {
    if (emTransicao.current) finalizar()
    // A mudança de rota confirma que a nova página entrou no mesmo WebView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotaAtual])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-2 top-[max(8px,env(safe-area-inset-top))] z-[9999] h-1 overflow-hidden rounded-full bg-primary/10 shadow-[0_1px_7px_rgba(82,17,35,.16)] transition-opacity duration-150 ${visivel ? "opacity-100" : "opacity-0"}`}
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
