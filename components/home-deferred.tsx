"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

const LiturgiaDiaria = dynamic(
  () => import("@/components/liturgia-diaria").then((mod) => mod.LiturgiaDiaria),
  { ssr: false, loading: () => <CarregandoSecao texto="Preparando a Liturgia…" /> },
)

const CalendarioLiturgico = dynamic(
  () => import("@/components/calendario-liturgico").then((mod) => mod.CalendarioLiturgico),
  { ssr: false, loading: () => <CarregandoSecao texto="Preparando o calendário…" /> },
)

function CarregandoSecao({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {texto}
    </div>
  )
}

function usePertoDaTela() {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (visivel) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisivel(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisivel(true)
          observer.disconnect()
        }
      },
      { rootMargin: "650px 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [visivel])

  return { ref, visivel }
}

export function DeferredLiturgia() {
  const { ref, visivel } = usePertoDaTela()
  return (
    <div ref={ref} className="min-h-32">
      {visivel ? <LiturgiaDiaria /> : <CarregandoSecao texto="A Liturgia será carregada ao se aproximar desta área." />}
    </div>
  )
}

export function DeferredCalendario() {
  const { ref, visivel } = usePertoDaTela()
  return (
    <div ref={ref} className="min-h-32">
      {visivel ? <CalendarioLiturgico /> : <CarregandoSecao texto="O calendário será carregado ao se aproximar desta área." />}
    </div>
  )
}
