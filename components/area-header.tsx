"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, LogOut, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { NotificationCenter } from "@/components/notification-center"
import { site } from "@/lib/site"

export function AreaHeader({
  titulo,
  subtitulo,
  badge,
  voltarHref,
  voltarLabel = "Voltar ao site",
  menu,
}: {
  titulo: string
  subtitulo?: string
  badge?: React.ReactNode
  voltarHref?: string
  voltarLabel?: string
  menu?: React.ReactNode
}) {
  const router = useRouter()
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [saindo, setSaindo] = useState(false)

  async function handleLogout() {
    if (saindo) return
    setSaindo(true)
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined)
      try {
        localStorage.removeItem("santa-luzia:sessao-offline:v1")
        sessionStorage.clear()
      } catch {}
      window.dispatchEvent(new CustomEvent("santa-luzia:logout"))
      router.replace("/area-restrita/login")
      router.refresh()
    } finally {
      setSaindo(false)
      setConfirmandoSaida(false)
    }
  }

  return (
    <>
      <header className="app-safe-header sticky top-0 z-50 w-full border-b border-accent/75 bg-white text-foreground shadow-sm" data-no-pull-refresh>
        <div className="app-header-row mx-auto flex w-full max-w-6xl items-center gap-2 px-[var(--app-gutter)] sm:min-h-[78px] sm:py-3">
          {voltarHref && (
            <Link href={voltarHref} title={voltarLabel} aria-label={voltarLabel} className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-primary active:scale-95 sm:size-10">
              <ArrowLeft className="size-[18px]" aria-hidden="true" />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate font-serif text-[1.16rem] font-semibold leading-tight tracking-tight text-primary sm:text-2xl">{titulo}</h1>
              {badge && <div className="hidden shrink-0 sm:block">{badge}</div>}
            </div>
            <p className="truncate text-[10px] leading-4 text-muted-foreground sm:text-sm">{subtitulo ?? site.comunidade}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationCenter />
            {menu}
            <button
              type="button"
              onClick={() => setConfirmandoSaida(true)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-white text-primary shadow-sm transition active:scale-95 sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm sm:font-medium"
              aria-label="Sair da Área Restrita"
              title="Sair"
              data-standard-logout="true"
            >
              <LogOut className="size-[19px]" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {confirmandoSaida && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]" role="presentation" onClick={() => !saindo && setConfirmandoSaida(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="titulo-confirmar-saida" className="w-full max-w-sm rounded-[24px] border border-white/70 bg-[#fffdf8] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()} data-logout-confirmation="true">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary"><LogOut className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 id="titulo-confirmar-saida" className="font-serif text-lg font-semibold text-primary">Deseja sair?</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Você voltará para a tela de entrada. Os dados já salvos neste aparelho continuam preservados para o funcionamento offline.</p>
              </div>
              <button type="button" disabled={saindo} onClick={() => setConfirmandoSaida(false)} aria-label="Fechar confirmação" className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-white text-primary disabled:opacity-50"><X className="size-4" /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saindo} onClick={() => setConfirmandoSaida(false)} className="min-h-11 rounded-xl border border-border bg-white px-4 text-sm font-bold text-foreground active:scale-[.98] disabled:opacity-50">Não</button>
              <button type="button" disabled={saindo} onClick={() => void handleLogout()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm active:scale-[.98] disabled:opacity-65">{saindo ? "Saindo…" : "Sim, sair"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export { Badge }
