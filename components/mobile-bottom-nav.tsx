"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { BookOpenText, BrainCircuit, CalendarDays, GraduationCap, Home, Library, LogIn } from "lucide-react"
import { carregarSessaoOffline } from "@/lib/offline-data"

const publicItems = [
  { href: "/visitante", label: "Início", icon: Home, motion: "panel" },
  { href: "/liturgia", label: "Liturgia", icon: BookOpenText, motion: "liturgy" },
  { href: "/escala", label: "Escala", icon: CalendarDays, motion: "scale" },
  { href: "/biblioteca", label: "Biblioteca", icon: Library, motion: "library" },
  { href: "/area-restrita/login", label: "Entrar", icon: LogIn },
]
const areaItems = [
  { href: "/visitante", label: "Início", icon: Home, motion: "panel" },
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
  const sessao = me?.sessao ?? sessaoOffline ?? null
  const items = sessao ? areaItems : publicItems
  const colunas = sessao ? "grid-cols-4" : "grid-cols-5"

  return (
    <>
      <style>{`
        [data-sl-nav-motion] svg{transform-box:fill-box;transform-origin:center;will-change:transform}
        [data-sl-nav-motion="library"] svg{animation:slR11Library 2.3s ease-in-out infinite}
        [data-sl-nav-motion="liturgy"] svg,[data-sl-nav-motion="formation"] svg{animation:slR11Page 2.5s ease-in-out infinite}
        [data-sl-nav-motion="panel"] svg{animation:slR11Panel 2.2s ease-in-out infinite}
        [data-sl-nav-motion="scale"] svg{animation:slR10ScaleMotion 2.1s ease-in-out infinite}
        [data-sl-nav-motion="quiz"] svg{animation:slR11Quiz 2s ease-in-out infinite}
        @keyframes slR11Library{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(-4deg)}}
        @keyframes slR11Page{0%,100%{transform:rotateY(0) translateY(0)}50%{transform:rotateY(-18deg) translateY(-1px)}}
        @keyframes slR11Panel{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-2px) scale(1.08)}}
        @keyframes slR10ScaleMotion{0%,100%{transform:translateY(0) rotate(0)}45%{transform:translateY(-1px) rotate(-3deg)}65%{transform:translateY(-1px) rotate(2deg)}}
        @keyframes slR11Quiz{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.1) rotate(4deg)}}
        @media(prefers-reduced-motion:reduce){[data-sl-nav-motion] svg{animation:none!important}}
      `}</style>
      <nav aria-label="Navegação principal" data-no-pull-refresh data-bottom-nav-network-stable="true" className="mobile-app-bottom-nav fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white/75 shadow-[0_10px_35px_rgba(55,28,20,.16)] backdrop-blur-2xl md:hidden">
        <div className={`grid ${colunas}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom),2px)" }}>
          {items.map((item) => {
            const active = ativo(pathname, item.href)
            const Icon = item.icon
            return <Link prefetch={windowsBeta && item.label === "Quiz"} key={item.href} href={item.href} data-sl-nav-motion={"motion" in item ? item.motion : undefined} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 font-bold transition active:scale-95 ${active ? "text-[#7b1326]" : "text-[#786b68]"}`}><span className={`flex size-8 items-center justify-center rounded-xl transition ${active ? "bg-[#7b1326] text-white shadow-md" : "bg-white/70 text-[#7b1326]"}`}><Icon className="size-[18px]" /></span><span className="w-full truncate text-center text-[9px] leading-3">{item.label}</span></Link>
          })}
        </div>
      </nav>
    </>
  )
}
