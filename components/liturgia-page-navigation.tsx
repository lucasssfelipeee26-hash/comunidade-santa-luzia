"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function LiturgiaPageNavigation() {
  const [leitor, setLeitor] = useState<HTMLElement | null>(null)
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(1)

  useEffect(() => {
    let atual: HTMLElement | null = null

    const atualizar = () => {
      const encontrado = document.querySelector<HTMLElement>(".liturgical-document")
      if (encontrado !== atual) {
        atual = encontrado
        setLeitor(encontrado)
        setPagina(0)
      }
      if (!encontrado) {
        setTotal(1)
        return
      }
      encontrado.style.columnWidth = `${Math.max(280, encontrado.clientWidth)}px`
      const passo = encontrado.clientWidth + 24
      const paginas = Math.max(1, Math.round((encontrado.scrollWidth + 24) / passo))
      setTotal(paginas)
      setPagina(Math.min(paginas - 1, Math.max(0, Math.round(encontrado.scrollLeft / passo))))
    }

    atualizar()
    const observer = new MutationObserver(() => requestAnimationFrame(atualizar))
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", atualizar)
    const timer = window.setInterval(atualizar, 700)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", atualizar)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!leitor) return
    const atualizar = () => {
      const passo = leitor.clientWidth + 24
      setPagina(Math.min(total - 1, Math.max(0, Math.round(leitor.scrollLeft / passo))))
    }
    leitor.addEventListener("scroll", atualizar, { passive: true })
    return () => leitor.removeEventListener("scroll", atualizar)
  }, [leitor, total])

  if (!leitor || total <= 1) return null

  const ir = (delta: number) => {
    const destino = Math.min(total - 1, Math.max(0, pagina + delta))
    leitor.scrollTo({ left: destino * (leitor.clientWidth + 24), behavior: "smooth" })
    setPagina(destino)
  }

  return (
    <div className="fixed inset-x-0 bottom-[78px] z-[58] mx-auto flex w-fit items-center gap-3 rounded-full border border-[#d4af37]/45 bg-[#fffdf8]/95 px-3 py-2 shadow-xl backdrop-blur md:bottom-5">
      <button type="button" onClick={() => ir(-1)} disabled={pagina === 0} aria-label="Página anterior" className="flex size-10 items-center justify-center rounded-full bg-[#7b1326] text-white disabled:bg-[#d8cec5] disabled:text-white/70">
        <ChevronLeft className="size-5" />
      </button>
      <span className="min-w-14 text-center text-xs font-bold text-[#6b5137]">{pagina + 1} / {total}</span>
      <button type="button" onClick={() => ir(1)} disabled={pagina >= total - 1} aria-label="Próxima página" className="flex size-10 items-center justify-center rounded-full bg-[#7b1326] text-white disabled:bg-[#d8cec5] disabled:text-white/70">
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
