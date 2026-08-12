"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import {
  BookOpenText,
  CalendarDays,
  GraduationCap,
  Home,
  Library,
  LogIn,
  Trophy,
  UserRound,
} from "lucide-react"

const publicItems = [
  { href: "/visitante", label: "Início", icon: Home },
  { href: "/visitante#liturgia", label: "Liturgia", icon: BookOpenText },
  { href: "/escala", label: "Escala", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/area-restrita/login", label: "Entrar", icon: LogIn },
]

const areaItems = [
  { href: "/area-restrita", label: "Painel", icon: UserRound },
  { href: "/escala", label: "Escala", icon: CalendarDays },
  { href: "/formacao", label: "Formação", icon: GraduationCap },
  { href: "/area-restrita/ranking", label: "Ranking", icon: Trophy },
  { href: "/visitante", label: "Visitante", icon: Home },
]


type MeNavResponse = { sessao: null | { tipo: "moderador" | "membro" } }
const navFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

const authPaths = [
  "/area-restrita/login",
  "/area-restrita/cadastro",
  "/area-restrita/recuperar-senha",
]

function ativo(pathname: string, href: string) {
  const route = href.split("#")[0] || "/"
  if (href.includes("#")) return pathname === route
  if (href === "/area-restrita") {
    return ["/area-restrita", "/area-restrita/membro", "/area-restrita/moderador"].includes(pathname)
  }
  return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const ocultar = pathname === "/" || authPaths.some((path) => pathname.startsWith(path))
  const { data: me } = useSWR<MeNavResponse>(ocultar ? null : "/api/auth/me", navFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  if (ocultar) return null

  // Depois do login, a navegação continua voltada ao perfil mesmo quando
  // o usuário abre Escala ou a página pública. Visitantes recebem apenas
  // os atalhos públicos.
  const autenticado = Boolean(me?.sessao)
  const items = autenticado ? areaItems : publicItems

  return (
    <nav
      aria-label="Navegação principal do aplicativo"
      data-no-pull-refresh
      className="mobile-app-bottom-nav fixed inset-x-0 bottom-0 z-[60] border-t border-[#d4af37]/60 bg-white shadow-[0_-4px_14px_rgba(67,31,18,.08)] md:hidden"
    >
      <div
        className="app-bottom-grid mx-auto grid max-w-md grid-cols-5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2px)" }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = ativo(pathname, href)
          return (
            <Link
              prefetch={false}
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`app-bottom-item flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1 font-bold transition active:scale-95 ${
                active ? "text-[#7b1326]" : "text-[#786b68]"
              }`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-2xl transition ${
                  active ? "bg-[#f6e7b7] text-[#7b1326]" : "text-[#7b1326]"
                }`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="w-full truncate text-center leading-3">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
