"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const ESPACO_ENTRE_PAGINAS = 24
const TOLERANCIA_DE_MEDICAO = 2

function contarPaginas(largura: number, larguraTotal: number) {
  const passo = Math.max(1, largura + ESPACO_ENTRE_PAGINAS)
  const excedente = Math.max(0, larguraTotal - largura - TOLERANCIA_DE_MEDICAO)
  return Math.max(1, 1 + Math.ceil(excedente / passo))
}

export function LeitorPaginado({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let quadro = 0
    const atualizar = () => {
      const largura = Math.max(1, el.clientWidth)
      const passo = largura + ESPACO_ENTRE_PAGINAS
      const paginas = contarPaginas(largura, el.scrollWidth)
      setTotal(paginas)
      setPagina(Math.min(paginas - 1, Math.max(0, Math.round(el.scrollLeft / passo))))
    }

    const agendarAtualizacao = () => {
      window.cancelAnimationFrame(quadro)
      quadro = window.requestAnimationFrame(() => {
        quadro = window.requestAnimationFrame(atualizar)
      })
    }

    const configurar = () => {
      // A coluna precisa ter exatamente a largura visível. O mínimo antigo de
      // 280 px criava uma falsa página extra em celulares mais estreitos.
      el.style.columnWidth = `${Math.max(1, el.clientWidth)}px`
      el.style.columnGap = `${ESPACO_ENTRE_PAGINAS}px`
      agendarAtualizacao()
    }

    configurar()
    const ro = new ResizeObserver(configurar)
    ro.observe(el)
    const mo = new MutationObserver(agendarAtualizacao)
    mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true })
    el.addEventListener("load", agendarAtualizacao, true)
    el.addEventListener("scroll", atualizar, { passive: true })
    document.fonts?.ready.then(agendarAtualizacao).catch(() => {})
    return () => {
      window.cancelAnimationFrame(quadro)
      ro.disconnect()
      mo.disconnect()
      el.removeEventListener("load", agendarAtualizacao, true)
      el.removeEventListener("scroll", atualizar)
    }
  }, [children])

  const ir = (delta: number) => {
    const el = ref.current
    if (!el) return
    const destino = Math.min(total - 1, Math.max(0, pagina + delta))
    el.scrollTo({ left: destino * (el.clientWidth + ESPACO_ENTRE_PAGINAS), behavior: "auto" })
    setPagina(destino)
  }

  return (
    <div className="mt-3">
      <div ref={ref} className="h-[clamp(300px,calc(100dvh-330px),620px)] overflow-x-auto overflow-y-hidden break-words [column-fill:auto] [column-gap:24px] [overflow-wrap:anywhere] [scrollbar-width:none] sm:h-[clamp(420px,64dvh,720px)] [&::-webkit-scrollbar]:hidden [&_img]:max-w-full [&_table]:max-w-full">
        {children}
      </div>
      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-[#d4af37]/35 bg-[#fffdf8] px-3 py-2 shadow-sm">
          <button type="button" onClick={() => ir(-1)} disabled={pagina === 0} aria-label="Página anterior" className="flex size-10 items-center justify-center rounded-full border border-[#d4af37]/55 bg-white text-[#8f182e] disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-24 text-center text-xs font-bold text-[#6b5137]">Página {pagina + 1} de {total}</span>
          <button type="button" onClick={() => ir(1)} disabled={pagina >= total - 1} aria-label="Próxima página" className="flex size-10 items-center justify-center rounded-full border border-[#d4af37]/55 bg-white text-[#8f182e] disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
