"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { Download, LogIn, Menu, UserPlus, X } from "lucide-react"
import { carregarSessaoOffline } from "@/lib/offline-data"
import { site } from "@/lib/site"

type HeaderMeResponse = { sessao: null | { tipo: "moderador" | "membro" } }
const headerFetcher = (url: string) => fetch(url, { cache: "no-store", credentials: "same-origin" }).then(async (r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [sessaoOffline, setSessaoOffline] = useState<HeaderMeResponse["sessao"] | undefined>(undefined)
  const { data: me } = useSWR<HeaderMeResponse>("/api/auth/me", headerFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
  })

  useEffect(() => {
    const cache = carregarSessaoOffline<HeaderMeResponse>()
    setSessaoOffline(cache?.dados?.sessao ?? null)
  }, [])

  const sessao = me?.sessao ?? sessaoOffline ?? null
  const autenticado = Boolean(sessao)

  return (
    <header className="app-safe-header sticky top-0 z-50 border-b border-[#d4af37]/60 bg-[#fffdf8] text-[#5f1020] shadow-[0_3px_14px_rgba(89,55,12,.08)]" data-no-pull-refresh>
      <div className="app-header-row mx-auto flex max-w-7xl items-center justify-between gap-2 px-[var(--app-gutter)] sm:py-3">
        <Link href="/visitante" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-full border-2 border-[#d4af37] shadow-sm sm:size-16 sm:shadow-md">
            <Image src="/images/santa-luzia-logo.jpg" alt="Santa Luzia" fill className="object-cover" sizes="(max-width: 640px) 40px, 64px" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9b7424] sm:block sm:text-xs">Comunidade</span>
            <span className="block truncate font-serif text-[17px] font-bold uppercase tracking-wide text-[#7b1326] sm:text-2xl">Santa Luzia</span>
            <span className="block max-w-[205px] truncate text-[8px] font-semibold uppercase text-[#4c1b24] sm:max-w-none sm:text-xs">Acólitos e Coroinhas São Padre Pio</span>
            <span className="hidden text-[9px] uppercase tracking-wide text-[#7b6b60] sm:block">{site.paroquia}</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {autenticado ? (
            <Link
              href="/area-restrita"
              aria-label="Abrir meu perfil"
              title="Meu perfil"
              data-main-profile-access="hamburger"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/60 bg-white text-[#7b1326] shadow-sm active:scale-95"
            >
              <Menu className="size-[19px]" />
            </Link>
          ) : (
            <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/60 bg-white text-[#7b1326] shadow-sm active:scale-95" aria-label={open ? "Fechar acesso" : "Abrir acesso"} aria-expanded={open}>
              {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
            </button>
          )}
        </div>
      </div>

      {!autenticado && open && (
        <div className="app-mobile-menu-layer fixed inset-x-0 bottom-0 z-[55]" data-no-pull-refresh>
          <button type="button" aria-label="Fechar acesso" className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <nav className="app-nav-panel absolute inset-x-3 top-3 mx-auto max-w-md rounded-3xl border border-[#d4af37]/45 bg-white p-3 shadow-2xl" aria-label="Acesso ao aplicativo">
            <div className="grid grid-cols-3 gap-2">
              <Link prefetch={false} href="/area-restrita/login" onClick={() => setOpen(false)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-[#fff8ee] px-1 py-3 text-center text-[#5f1020] active:scale-95">
                <span className="flex size-10 items-center justify-center rounded-full border border-[#7b1326]/10 bg-white text-[#7b1326] shadow-sm"><LogIn className="size-5" /></span>
                <span className="text-[9px] font-bold leading-4">Entrar</span>
              </Link>
              <Link prefetch={false} href="/area-restrita/cadastro" onClick={() => setOpen(false)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-[#fff8ee] px-1 py-3 text-center text-[#5f1020] active:scale-95">
                <span className="flex size-10 items-center justify-center rounded-full border border-[#7b1326]/10 bg-white text-[#7b1326] shadow-sm"><UserPlus className="size-5" /></span>
                <span className="text-[9px] font-bold leading-4">Cadastro</span>
              </Link>
              <Link data-web-download-only prefetch={false} href="/baixar" onClick={() => setOpen(false)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-[#fff8ee] px-1 py-3 text-center text-[#5f1020] active:scale-95">
                <span className="flex size-10 items-center justify-center rounded-full border border-[#7b1326]/10 bg-white text-[#7b1326] shadow-sm"><Download className="size-5" /></span>
                <span className="text-[9px] font-bold leading-4">Baixar app</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
