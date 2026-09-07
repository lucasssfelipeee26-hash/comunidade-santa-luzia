"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpenText, BrainCircuit, CalendarDays, GraduationCap, Home, Library, LogIn } from "lucide-react"
import { useAuthSession } from "@/components/auth-session-runtime"

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

const authPaths = ["/area-restrita/login", "/area-restrita/cadastro", "/area-restrita/recuperar-senha"]
const NAV_FAILSAFE_MS = 3_000

function routeOf(href: string) {
  return href.split(/[?#]/)[0] || "/"
}

function sameRoute(pathname: string, href: string) {
  return pathname === routeOf(href)
}

function ativo(pathname: string, href: string) {
  const route = routeOf(href)
  if (href.includes("#")) return pathname === route
  if (href === "/visitante") return pathname === "/visitante" || pathname === "/"
  return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { sessao } = useAuthSession()
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const pathnameRef = useRef(pathname)
  const pendingRef = useRef<string | null>(null)
  const queuedRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const routerRef = useRef(router)
  routerRef.current = router
  pathnameRef.current = pathname

  function clearFailsafe() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  function beginNavigation(target: string) {
    if (sameRoute(pathnameRef.current, target)) return
    pendingRef.current = target
    setPendingTarget(target)
    clearFailsafe()
    routerRef.current.push(target)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const queued = queuedRef.current
      queuedRef.current = null
      pendingRef.current = null
      setPendingTarget(null)
      if (queued && !sameRoute(pathnameRef.current, queued)) {
        window.requestAnimationFrame(() => beginNavigation(queued))
      }
    }, NAV_FAILSAFE_MS)
  }

  function requestNavigation(target: string) {
    if (sameRoute(pathnameRef.current, target)) {
      queuedRef.current = null
      return
    }
    if (pendingRef.current) {
      // Trocas rápidas de aba não podem lançar várias transições React em paralelo.
      // Guardamos somente o último destino pedido pelo usuário.
      queuedRef.current = target
      return
    }
    beginNavigation(target)
  }

  useEffect(() => {
    const pending = pendingRef.current
    if (!pending || !sameRoute(pathname, pending)) return

    clearFailsafe()
    pendingRef.current = null
    setPendingTarget(null)
    const queued = queuedRef.current
    queuedRef.current = null
    if (queued && !sameRoute(pathname, queued)) {
      window.requestAnimationFrame(() => beginNavigation(queued))
    }
    // pathname é o sinal de commit da rota no mesmo WebView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => () => clearFailsafe(), [])

  const ocultar = pathname === "/" || authPaths.some((p) => pathname.startsWith(p))
  if (ocultar) return null

  const items = sessao ? areaItems : publicItems
  const colunas = sessao ? "grid-cols-4" : "grid-cols-5"

  return (
    <nav
      aria-label="Navegação principal"
      aria-busy={Boolean(pendingTarget)}
      data-no-pull-refresh
      data-bottom-nav-network-stable="true"
      data-navigation-pending={pendingTarget ? "true" : "false"}
      className="mobile-app-bottom-nav fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white/95 shadow-[0_10px_35px_rgba(55,28,20,.16)] md:hidden"
    >
      <div className={`grid ${colunas}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom),2px)" }}>
        {items.map((item) => {
          const active = ativo(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              prefetch={false}
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                requestNavigation(item.href)
              }}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 font-bold transition-colors duration-100 active:opacity-100 ${active ? "text-[#7b1326]" : "text-[#786b68]"}`}
            >
              <span
                data-bottom-nav-static-icon="true"
                className={`flex size-8 items-center justify-center rounded-xl transition-colors duration-100 ${active ? "bg-[#7b1326] text-white shadow-md" : "bg-white text-[#7b1326]"}`}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="w-full truncate text-center text-[9px] leading-3">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
