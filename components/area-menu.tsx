"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarDays,
  ClipboardPlus,
  LayoutDashboard,
  Menu,
  Palette,
  UserRound,
  X,
} from "lucide-react"

type ItemMenu = {
  href: string
  label: string
  icon: React.ReactNode
}

function MenuArea({ itens, rotulo }: { itens: ItemMenu[]; rotulo: string }) {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="menu"
        onClick={() => setAberto((valor) => !valor)}
        className="inline-flex size-10 items-center justify-center rounded-md border border-primary/30 bg-white/90 text-primary shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
      >
        {aberto ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setAberto(false)}
          />
          <nav
            role="menu"
            className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
          >
            <div className="border-b border-accent/35 bg-accent/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Menu da Área Restrita</p>
            </div>
            <div className="p-2">
              {itens.map((item) => {
                const ativo = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setAberto(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      ativo
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <span className="text-primary">{item.icon}</span>
                    {item.label}
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
    {
      href: "/area-restrita/moderador",
      label: "Painel do Moderador",
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      href: "/area-restrita/moderador/escala",
      label: "Montar Escala do Dia",
      icon: <CalendarDays className="size-4" />,
    },
    {
      href: "/area-restrita/moderador/formacao",
      label: "Gerenciar Formação",
      icon: <BookOpen className="size-4" />,
    },
    {
      href: "/area-restrita/moderador/registro",
      label: "Novo Registro",
      icon: <ClipboardPlus className="size-4" />,
    },
    {
      href: "/area-restrita/moderador/tema",
      label: "Cores do Site",
      icon: <Palette className="size-4" />,
    },
    {
      href: "/escala",
      label: "Ver Escala Publicada",
      icon: <CalendarDays className="size-4" />,
    },
    {
      href: "/formacao",
      label: "Ver Central de Formação",
      icon: <BookOpen className="size-4" />,
    },
  ]

  return <MenuArea itens={itens} rotulo="Abrir menu do moderador" />
}

export function MembroMenu() {
  const itens: ItemMenu[] = [
    {
      href: "/area-restrita/membro",
      label: "Meu Perfil",
      icon: <UserRound className="size-4" />,
    },
    {
      href: "/escala",
      label: "Escala do Dia",
      icon: <CalendarDays className="size-4" />,
    },
    {
      href: "/formacao",
      label: "Formação",
      icon: <BookOpen className="size-4" />,
    },
  ]

  return <MenuArea itens={itens} rotulo="Abrir menu da área restrita" />
}
