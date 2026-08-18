"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import useSWR from "swr"
import {
  BookOpenText,
  CalendarDays,
  Home,
  Library,
  LogIn,
  Menu,
  Download,
  UserPlus,
  X,
} from "lucide-react"
import { PrayerPersonIcon } from "@/components/prayer-person-icon"
import { carregarSessaoOffline } from "@/lib/offline-data"
import { site } from "@/lib/site"

const publicBaseLinks = [
  { href: "/visitante", label: "Início", curto: "Início", icon: Home },
  { href: "/liturgia", label: "Centro Litúrgico", curto: "Liturgia", icon: BookOpenText },
  { href: "/escala", label: "Escala do Dia", curto: "Escala", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", curto: "Biblioteca", icon: Library },
  { href: "/baixar", label: "Baixar aplicativo", curto: "Baixar app", icon: Download, downloadOnly: true },
]

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
    dedupingInterval: 60_000,
  })

  useEffect(() => {
    const cache = carregarSessaoOffline<HeaderMeResponse>()
    setSessaoOffline(cache?.dados?.sessao ?? null)
  }, [])

  const sessao = me === undefined ? sessaoOffline : me.sessao
  const autenticado = Boolean(sessao)
  const acessoHref = autenticado ? "/area-restrita" : "/area-restrita/login"
  const acessoLabel = autenticado ? "Meu painel" : "Entrar"

  // Para uma conta já autenticada, Início fica exclusivamente na barra inferior.
  // O menu superior ganha o painel/perfil com o ícone da pessoa em oração.
  const navLinks = autenticado
    ? [
        ...publicBaseLinks.filter((link) => link.href !== "/visitante"),
        { href: "/area-restrita", label: "Meu painel", curto: "Painel", icon: PrayerPersonIcon },
      ]
    : [
        ...publicBaseLinks,
        { href: "/area-restrita/cadastro", label: "Solicitar acesso", curto: "Cadastro", icon: UserPlus },
        { href: "/area-restrita/login", label: "Entrar", curto: "Entrar", icon: LogIn },
      ]

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

        <nav className="hidden items-center gap-1 xl:flex">
          {navLinks.slice(0, 5).map((link) => (
            <Link data-web-download-only={"downloadOnly" in link && link.downloadOnly ? "" : undefined} prefetch={false} key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-semibold text-[#5f1020] transition hover:bg-[#f6ecd1] hover:text-[#7b1326]">
              {link.label}
            </Link>
          ))}
          <Link prefetch={false} href={acessoHref} className="ml-3 inline-flex items-center gap-2 rounded-md border border-[#c99a2e] bg-[#f6e7b7] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[#681225] shadow-sm transition hover:bg-[#d4af37] hover:text-[#4b0b17]">
            {autenticado ? <PrayerPersonIcon className="size-4" /> : <LogIn className="size-4" />} {acessoLabel}
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/60 bg-white text-[#7b1326] shadow-sm active:scale-95 sm:size-10 xl:hidden"
          aria-label={open ? "Fechar navegação" : "Abrir navegação"}
          aria-expanded={open}
        >
          {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
        </button>
      </div>

      {open && (
        <div className="app-mobile-menu-layer fixed inset-x-0 bottom-0 z-[55] xl:hidden" data-no-pull-refresh>
          <button type="button" aria-label="Fechar navegação" className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <nav className="app-nav-panel absolute inset-x-3 top-3 mx-auto max-w-md rounded-3xl border border-[#d4af37]/45 bg-white p-3 shadow-2xl">
            <div className="grid grid-cols-3 gap-2">
              {navLinks.map(({ href, curto, label, icon: Icon }) => (
                <Link
                  data-web-download-only={href === "/baixar" ? "" : undefined}
                  prefetch={false}
                  key={href}
                  href={href}
                  title={label}
                  onClick={() => setOpen(false)}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-[#fff8ee] px-1 py-2.5 text-center text-[#5f1020] active:scale-95"
                >
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-[#7b1326] shadow-sm"><Icon className="size-5" /></span>
                  <span className="line-clamp-2 min-h-8 text-[9px] font-bold leading-4">{curto}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
