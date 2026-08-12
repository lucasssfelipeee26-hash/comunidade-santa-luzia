"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ClipboardPlus,
  LayoutDashboard,
  Menu,
  Palette,
  Trophy,
  UserRound,
  X,
} from "lucide-react"

type ItemMenu = {
  href: string
  label: string
  curto: string
  icon: React.ReactNode
}

function MenuArea({ itens, rotulo }: { itens: ItemMenu[]; rotulo: string }) {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  return (
    <div className="relative shrink-0" data-no-pull-refresh>
      <button
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        onClick={() => setAberto((valor) => !valor)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-white text-primary shadow-sm transition active:scale-95 sm:size-10"
      >
        {aberto ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-[70] cursor-default bg-black/25 backdrop-blur-[2px]"
            onClick={() => setAberto(false)}
          />

          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Menu da Área Restrita"
            className="app-nav-panel fixed left-1/2 top-1/2 z-[80] w-[calc(100%_-_24px)] max-w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-accent/45 bg-white p-3 text-card-foreground shadow-2xl sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-primary">Navegação</p>
                <p className="truncate text-xs text-muted-foreground">Escolha uma área do aplicativo</p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="app-nav-grid grid grid-cols-4 gap-2 sm:gap-3">
              {itens.map((item) => {
                const ativo = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                return (
                  <Link
                    prefetch={false}
                    key={item.href}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    className={`app-nav-tile flex min-w-0 flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-2.5 text-center transition active:scale-95 sm:py-3 ${
                      ativo
                        ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                        : "bg-secondary/55 text-foreground hover:bg-secondary"
                    }`}
                    title={item.label}
                  >
                    <span className={`flex size-10 items-center justify-center rounded-2xl ${ativo ? "bg-primary text-white" : "bg-white text-primary shadow-sm"}`}>
                      {item.icon}
                    </span>
                    <span className="line-clamp-2 min-h-[2.15rem] w-full text-[9px] font-bold leading-[1.05rem] sm:text-[10px]">
                      {item.curto}
                    </span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  )
}

export function ModeradorMenu() {
  const itens: ItemMenu[] = [
    { href: "/area-restrita/moderador", label: "Painel do Moderador", curto: "Painel", icon: <LayoutDashboard className="size-5" /> },
    { href: "/area-restrita/moderador/escala", label: "Montar Escala do Dia", curto: "Montar escala", icon: <CalendarCheck2 className="size-5" /> },
    { href: "/area-restrita/moderador/formacao", label: "Gerenciar Formação", curto: "Formação", icon: <BookOpen className="size-5" /> },
    { href: "/area-restrita/moderador/registro", label: "Novo Registro", curto: "Registro", icon: <ClipboardPlus className="size-5" /> },
    { href: "/area-restrita/moderador/ranking", label: "Gerenciar Ranking e Quiz", curto: "Ranking / Quiz", icon: <Trophy className="size-5" /> },
    { href: "/area-restrita/moderador/tema", label: "Cores do Site", curto: "Cores", icon: <Palette className="size-5" /> },
    { href: "/escala", label: "Ver Escala Publicada", curto: "Escala pública", icon: <CalendarDays className="size-5" /> },
    { href: "/formacao", label: "Ver Central de Formação", curto: "Central", icon: <BookOpen className="size-5" /> },
  ]
  return <MenuArea itens={itens} rotulo="Abrir navegação do moderador" />
}

export function MembroMenu() {
  const itens: ItemMenu[] = [
    { href: "/area-restrita/membro", label: "Meu Perfil", curto: "Meu perfil", icon: <UserRound className="size-5" /> },
    { href: "/area-restrita/ranking", label: "Ranking e Quiz", curto: "Ranking / Quiz", icon: <Trophy className="size-5" /> },
    { href: "/escala", label: "Escala do Dia", curto: "Escala", icon: <CalendarDays className="size-5" /> },
    { href: "/formacao", label: "Formação", curto: "Formação", icon: <BookOpen className="size-5" /> },
  ]
  return <MenuArea itens={itens} rotulo="Abrir navegação da Área Restrita" />
}
