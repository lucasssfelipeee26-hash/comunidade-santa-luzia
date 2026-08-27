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
const fetcher = (url: string) => fetch(url, { cache: "no-store", credentials: "same-origin" }).then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
const authPaths = ["/area-restrita/login", "/area-restrita/cadastro", "/area-restrita/recuperar-senha"]

function ativo(pathname: string, href: string) {
  const route = href.split("#")[0] || "/"
  if (href.includes("#")) return pathname === route
  if (href === "/visitante") return pathname === "/visitante" || pathname === "/"
  return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
}

function animarIcone(event: React.MouseEvent<HTMLAnchorElement>, motion: string) {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const svg = event.currentTarget.querySelector("svg")
    if (!(svg instanceof SVGElement) || typeof svg.animate !== "function") return
    svg.getAnimations().forEach((animation) => animation.cancel())
    const frames: Record<string, Keyframe[]> = {
      home: [
        { transform: "translateY(3px) scale(.86)", offset: 0 },
        { transform: "translateY(-3px) scale(1.10)", offset: .48 },
        { transform: "translateY(0) scale(1)", offset: 1 },
      ],
      scale: [{ transform: "rotateX(20deg) scale(.9)" }, { transform: "rotateX(-8deg) scale(1.06)" }, { transform: "none" }],
      formation: [{ transform: "rotate(-12deg) scale(.9)" }, { transform: "rotate(8deg) scale(1.06)" }, { transform: "none" }],
      quiz: [{ transform: "scale(.86)" }, { transform: "scale(1.12)" }, { transform: "scale(.97)" }, { transform: "scale(1)" }],
      liturgy: [{ transform: "perspective(80px) rotateY(-18deg) scale(.92)" }, { transform: "perspective(80px) rotateY(8deg) scale(1.04)" }, { transform: "none" }],
      library: [{ transform: "perspective(80px) rotateY(-18deg) scale(.92)" }, { transform: "perspective(80px) rotateY(8deg) scale(1.04)" }, { transform: "none" }],
      login: [{ transform: "translateX(-3px)", opacity: .7 }, { transform: "translateX(3px)", opacity: 1 }, { transform: "none", opacity: 1 }],
    }
    svg.animate(frames[motion] || frames.home, { duration: motion === "home" ? 660 : 700, easing: "cubic-bezier(.2,.8,.2,1)" })
  } catch {}
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const ocultar = pathname === "/" || authPaths.some((p) => pathname.startsWith(p))
  const [sessaoOffline, setSessaoOffline] = useState<MeNavResponse["sessao"] | undefined>(undefined)
  const [windowsBeta, setWindowsBeta] = useState(false)
  const { data: me } = useSWR<MeNavResponse>(ocultar ? null : "/api/auth/me", fetcher, { revalidateOnFocus: false, revalidateOnReconnect: true, shouldRetryOnError: false, dedupingInterval: 60_000 })

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
        .sl-nav-icon-shell svg{transform-box:fill-box;transform-origin:center}
        .sl-nav-item:active .sl-nav-icon-shell{transform:scale(.91)}
        .sl-nav-icon-shell{transition:transform .16s ease,background-color .2s ease,color .2s ease}
        @media(prefers-reduced-motion:reduce){.sl-nav-icon-shell svg{animation:none!important}}
      `}</style>
      <nav aria-label="Navegação principal" data-no-pull-refresh data-bottom-nav-network-stable="true" className="mobile-app-bottom-nav fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white/75 shadow-[0_10px_35px_rgba(55,28,20,.16)] backdrop-blur-2xl md:hidden">
        <div className={`grid ${colunas}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom),2px)" }}>
          {items.map((item) => {
            const active = ativo(pathname, item.href)
            const Icon = item.icon
            return <Link prefetch={windowsBeta && item.label === "Quiz"} key={item.href} href={item.href} data-sl-nav-motion={item.motion} data-active={active ? "true" : "false"} aria-current={active ? "page" : undefined} onClick={(event) => animarIcone(event, item.motion)} className={`sl-nav-item flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 font-bold transition active:scale-95 ${active ? "text-[#7b1326]" : "text-[#786b68]"}`}>
              <span className={`sl-nav-icon-shell flex size-8 items-center justify-center rounded-xl ${active ? "bg-[#7b1326] text-white shadow-md" : "bg-white/70 text-[#7b1326]"}`} data-motion={item.motion}><Icon className="size-[18px]" /></span>
              <span className="w-full truncate text-center text-[9px] leading-3">{item.label}</span>
            </Link>
          })}
        </div>
      </nav>
    </>
  )
}
