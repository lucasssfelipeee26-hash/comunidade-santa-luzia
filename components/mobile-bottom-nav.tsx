"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { BookOpenText, BrainCircuit, CalendarDays, GraduationCap, Home, Library, LogIn } from "lucide-react"
import { carregarSessaoOffline } from "@/lib/offline-data"

const publicItems = [
  { href: "/visitante", label: "Início", icon: Home, motion: "home" },
  { href: "/liturgia", label: "Liturgia", icon: BookOpenText, motion: "liturgy" },
  { href: "/escala", label: "Escala", icon: CalendarDays, motion: "scale" },
  { href: "/biblioteca", label: "Biblioteca", icon: Library, motion: "library" },
  { href: "/area-restrita/login", label: "Entrar", icon: LogIn, motion: "login" },
]

const areaItems = [
  { href: "/visitante", label: "Início", icon: Home, motion: "home" },
  { href: "/escala", label: "Escala", icon: CalendarDays, motion: "scale" },
  { href: "/formacao", label: "Formação", icon: GraduationCap, motion: "formation" },
  { href: "/area-restrita/ranking", label: "Quiz", icon: BrainCircuit, motion: "quiz" },
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
  const [windowsBeta, setWindowsBeta] = useState(false)
  const { data: me } = useSWR<MeNavResponse>(ocultar ? null : "/api/auth/me", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
  })

  useEffect(() => {
    setWindowsBeta(navigator.userAgent.includes("SantaLuziaWindowsBeta/"))
    const cache = carregarSessaoOffline<MeNavResponse>()
    setSessaoOffline(cache?.dados?.sessao ?? null)
  }, [])

  if (ocultar) return null

  // A barra não depende da rede: usa a sessão salva imediatamente no aparelho.
  const sessao = me?.sessao ?? sessaoOffline ?? null
  const items = sessao ? areaItems : publicItems
  const colunas = sessao ? "grid-cols-4" : "grid-cols-5"

  return (
    <>
      <style>{`
        .sl-nav-icon-shell svg { transform-box: fill-box; transform-origin: center; }
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="home"] svg { animation: slNavHome .62s cubic-bezier(.2,.8,.2,1) both; }
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="liturgy"] svg,
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="library"] svg { animation: slNavBook .68s cubic-bezier(.2,.8,.2,1) both; }
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="scale"] svg { animation: slNavCalendar .68s cubic-bezier(.2,.8,.2,1) both; }
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="formation"] svg { animation: slNavCap .72s cubic-bezier(.2,.8,.2,1) both; }
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="quiz"] svg { animation: slNavBrain .78s cubic-bezier(.2,.8,.2,1) both; }
        .sl-nav-item[data-active="true"] .sl-nav-icon-shell[data-motion="login"] svg { animation: slNavLogin .7s cubic-bezier(.2,.8,.2,1) both; }
        .sl-nav-item:active .sl-nav-icon-shell { transform: scale(.91); }
        .sl-nav-icon-shell { transition: transform .16s ease, background-color .2s ease, color .2s ease; }
        @keyframes slNavHome { 0%{transform:translateY(3px) scale(.88)} 55%{transform:translateY(-2px) scale(1.08)} 100%{transform:none} }
        @keyframes slNavBook { 0%{transform:perspective(80px) rotateY(-18deg) scale(.92)} 60%{transform:perspective(80px) rotateY(8deg) scale(1.04)} 100%{transform:none} }
        @keyframes slNavCalendar { 0%{transform:translateY(2px) rotateX(20deg) scale(.9)} 50%{transform:translateY(-2px) rotateX(-8deg) scale(1.05)} 100%{transform:none} }
        @keyframes slNavCap { 0%{transform:rotate(-12deg) translateY(2px) scale(.9)} 50%{transform:rotate(8deg) translateY(-2px) scale(1.05)} 100%{transform:none} }
        @keyframes slNavBrain { 0%{transform:scale(.86)} 40%{transform:scale(1.1)} 70%{transform:scale(.97)} 100%{transform:scale(1)} }
        @keyframes slNavLogin { 0%{transform:translateX(-3px);opacity:.72} 55%{transform:translateX(2px);opacity:1} 100%{transform:none} }
        @media (prefers-reduced-motion:reduce) { .sl-nav-item[data-active="true"] .sl-nav-icon-shell svg { animation:none !important; } }
      `}</style>
      <nav aria-label="Navegação principal" data-no-pull-refresh data-bottom-nav-network-stable="true" className="mobile-app-bottom-nav fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white/75 shadow-[0_10px_35px_rgba(55,28,20,.16)] backdrop-blur-2xl md:hidden">
        <div className={`grid ${colunas}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom),2px)" }}>
          {items.map((item) => {
            const active = ativo(pathname, item.href)
            const Icon = item.icon
            const className = `sl-nav-item flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 font-bold transition active:scale-95 ${active ? "text-[#7b1326]" : "text-[#786b68]"}`
            const iconClass = `sl-nav-icon-shell flex size-8 items-center justify-center rounded-xl ${active ? "bg-[#7b1326] text-white shadow-md" : "bg-white/70 text-[#7b1326]"}`
            return <Link prefetch={windowsBeta && item.label === "Quiz"} key={item.href} href={item.href} data-sl-nav-motion={item.motion} data-active={active ? "true" : "false"} aria-current={active ? "page" : undefined} className={className}><span className={iconClass} data-motion={item.motion}><Icon className="size-[18px]" /></span><span className="w-full truncate text-center text-[9px] leading-3">{item.label}</span></Link>
          })}
        </div>
      </nav>
    </>
  )
}
