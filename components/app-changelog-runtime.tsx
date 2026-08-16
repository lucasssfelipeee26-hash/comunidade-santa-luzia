"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Sparkles, X } from "lucide-react"

type Novidades = {
  id: string
  title: string
  message: string
  highlights: string[]
  publishedAt?: string
}

type Status = { novidades?: Novidades }

const EVENTO_STATUS = "santa-luzia:app-status"
const PREFIXO = "santa-luzia:novidades-vistas:"

export function AppChangelogRuntime() {
  const [novidades, setNovidades] = useState<Novidades | null>(null)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    function avaliar(item?: Novidades) {
      if (!item?.id) return
      setNovidades(item)
      try {
        if (!localStorage.getItem(`${PREFIXO}${item.id}`)) setAberto(true)
      } catch { setAberto(true) }
    }

    const aoStatus = (event: Event) => avaliar((event as CustomEvent<Status>).detail?.novidades)
    window.addEventListener(EVENTO_STATUS, aoStatus)
    fetch("/api/app/status", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((status) => avaliar(status?.novidades))
      .catch(() => undefined)
    return () => window.removeEventListener(EVENTO_STATUS, aoStatus)
  }, [])

  function fechar() {
    if (novidades?.id) {
      try { localStorage.setItem(`${PREFIXO}${novidades.id}`, String(Date.now())) } catch {}
    }
    setAberto(false)
  }

  if (!novidades || !aberto) return null

  return (
    <aside className="fixed inset-x-3 bottom-20 z-[95] mx-auto max-w-xl rounded-[26px] border border-white/70 bg-[#fffdf8]/97 p-4 shadow-[0_20px_60px_rgba(58,18,29,.22)] backdrop-blur-2xl sm:bottom-5" role="status" aria-live="polite" data-no-pull-refresh>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md"><Sparkles className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Novidades do Santa Luzia</p>
          <h2 className="mt-0.5 font-serif text-xl font-semibold text-foreground">{novidades.title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{novidades.message}</p>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar novidades" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition active:scale-95"><X className="size-4" /></button>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {novidades.highlights.slice(0, 4).map((item) => <div key={item} className="flex items-start gap-2 rounded-xl bg-primary/[.035] px-3 py-2 text-[11px] leading-4 text-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />{item}</div>)}
      </div>
      <button type="button" onClick={fechar} className="mt-3 min-h-10 w-full rounded-2xl bg-primary px-4 text-sm font-bold text-white shadow-sm active:scale-[.99]">Entendi</button>
    </aside>
  )
}
