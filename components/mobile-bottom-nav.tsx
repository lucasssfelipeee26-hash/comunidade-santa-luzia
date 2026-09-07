"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { BookOpenText, BrainCircuit, CalendarDays, GraduationCap, Home, Library, LogIn } from "lucide-react"
import { carregarSessaoOffline } from "@/lib/offline-data"

const publicItems = [
  { href: "/visitante", label: "Início", icon: Home },
  { href: "/liturgia", label: "Liturgia", icon: BookOpenText },
  { href: "/escala", label: "Escala", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/area-restrita/login", label: "Entrar", icon: LogIn },
]
const areaItems = [
  { href: "/visitante", label: "Início", icon: Home },
  { href: "/escala", label: "Escala", icon: CalendarDays },
  { href: "/formacao", label: "Formação", icon: GraduationCap },
  { href: "/area-restrita/ranking", label: "Quiz", icon: BrainCircuit },
]

type MeNavResponse = { sessao: null | { tipo: "moderador" | "membro" } }
const fetcher = (url: string) => fetch(url, { cache: "no-store", credentials: "same-origin" }).then(async (r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})
const authPaths = ["/area-restrita/login", "/area-restrita/cadastro", "/area-restrita/recuperar-senha"]

function ativo(pathname: string, href: string) {
  const route = href.split("#")[0] || "/"
  if (href.includes("#")) return pathname === route
  if (href === "/visitante") return pathname === "/visitante" || pathname === "/"
  return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const ocultar = pathname === "/" || authPaths.some((p) => pathname.startsWith(p))
  const [sessaoOffline, setSessaoOffline] = useState<MeNavResponse["sessao"] | undefined>(undefined)
  const { data: me } = useSWR<MeNavResponse>(ocultar ? null : "/api/auth/me", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
  })

  useEffect(() => {
    const cache = carregarSessaoOffline<MeNavResponse>()
    setSessaoOffline(cache?.dados?.sessao ?? null)
  }, [])

  if (ocultar) return null
  const sessao = me?.sessao ?? sessaoOffline ?? null
  const items = sessao ? areaItems : publicItems
  const colunas = sessao ? "grid-cols-4" : "grid-cols-5"

  return (
    <nav aria-label="Navegação principal" data-no-pull-refresh data-bottom-nav-network-stable="true" className="mobile-app-bottom-nav fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white/95 shadow-[0_10px_35px_rgba(55,28,20,.16)] md:hidden">
      <div className={`grid ${colunas}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom),2px)" }}>
        {items.map((item) => {
          const active = ativo(pathname, item.href)
          const Icon = item.icon
          return <Link prefetch key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 font-bold transition-colors duration-100 active:opacity-80 ${active ? "text-[#7b1326]" : "text-[#786b68]"}`}><span className={`flex size-8 items-center justify-center rounded-xl transition-colors duration-100 ${active ? "bg-[#7b1326] text-white shadow-md" : "bg-white text-[#7b1326]"}`}><Icon className="size-[18px]" /></span><span className="w-full truncate text-center text-[9px] leading-3">{item.label}</span></Link>
        })}
      </div>
    </nav>
  )
}
