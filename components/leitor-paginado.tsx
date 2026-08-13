"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function LeitorPaginado({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const atualizar = () => {
      const largura = Math.max(1, el.clientWidth)
      const passo = largura + 24
      const paginas = Math.max(1, Math.round((el.scrollWidth + 24) / passo))
      setTotal(paginas)
      setPagina(Math.min(paginas - 1, Math.max(0, Math.round(el.scrollLeft / passo))))
    }

    const configurar = () => {
      el.style.columnWidth = `${Math.max(280, el.clientWidth)}px`
      requestAnimationFrame(atualizar)
    }

    configurar()
    const ro = new ResizeObserver(configurar)
    ro.observe(el)
    el.addEventListener("scroll", atualizar, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener("scroll", atualizar)
    }
  }, [children])

  const ir = (delta: number) => {
    const el = ref.current
    if (!el) return
    const destino = Math.min(total - 1, Math.max(0, pagina + delta))
    el.scrollTo({ left: destino * (el.clientWidth + 24), behavior: "smooth" })
    setPagina(destino)
  }

  return (
    <div className="mt-3">
      <div ref={ref} className="h-[clamp(300px,calc(100dvh-330px),620px)] overflow-x-auto overflow-y-hidden [column-fill:auto] [column-gap:24px] [scrollbar-width:none] sm:h-[clamp(420px,64dvh,720px)] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-[#d4af37]/35 bg-[#fffdf8] px-3 py-2 shadow-sm">
          <button type="button" onClick={() => ir(-1)} disabled={pagina === 0} aria-label="Página anterior" className="flex size-10 items-center justify-center rounded-full border border-[#d4af37]/55 bg-white text-[#8f182e] disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-16 text-center text-xs font-bold text-[#6b5137]">{pagina + 1} / {total}</span>
          <button type="button" onClick={() => ir(1)} disabled={pagina >= total - 1} aria-label="Próxima página" className="flex size-10 items-center justify-center rounded-full border border-[#d4af37]/55 bg-white text-[#8f182e] disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
