"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  BrainCircuit,
  Bug,
  CalendarCheck2,
  CalendarDays,
  ClipboardCheck,
  ClipboardPlus,
  Clock3,
  LayoutDashboard,
  Menu,
  Palette,
  Sparkles,
  X,
} from "lucide-react"
import { PrayerPersonIcon } from "@/components/prayer-person-icon"

type ItemMenu = { href: string; label: string; curto: string; icon: React.ReactNode; motion?: "panel" | "scale" | "liturgy" | "library" | "formation" | "quiz" | "clock" | "presence" | "record" }

function MenuArea({ itens, rotulo }: { itens: ItemMenu[]; rotulo: string }) {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  return (
    <div className="relative shrink-0" data-no-pull-refresh>
      <button
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        className="inline-flex size-10 items-center justify-center rounded-2xl border border-white/70 bg-white/75 text-primary shadow-md backdrop-blur-xl transition active:scale-95"
      >
        {aberto ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-[70] cursor-default bg-black/25 backdrop-blur-sm"
            onClick={() => setAberto(false)}
          />
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Menu da Área Restrita"
            className="app-nav-panel fixed left-1/2 top-1/2 z-[80] w-[calc(100%_-_24px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Navegação</p>
                <p className="text-xs text-muted-foreground">Escolha uma área</p>
              </div>
              <button
                type="button"
                aria-label="Fechar navegação"
                onClick={() => setAberto(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-primary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="app-nav-grid grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
              {itens.map((item) => {
                const ativo = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                return (
                  <Link
                    prefetch={false}
                    key={item.href}
                    href={item.href}
                    data-sl-nav-motion={item.motion}
                    onClick={() => setAberto(false)}
                    className={`app-nav-tile flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center transition active:scale-95 ${
                      ativo
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "bg-white/65 text-foreground hover:bg-white"
                    }`}
                    title={item.label}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                        ativo ? "bg-primary text-white" : "bg-white text-primary"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="line-clamp-2 min-h-[2rem] max-w-full break-words text-[9px] font-bold leading-4">
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
    { href: "/area-restrita/moderador", label: "Painel do Moderador", curto: "Painel", icon: <LayoutDashboard className="size-5" />, motion: "panel" },
    { href: "/area-restrita/atrasos", label: "Central de Atrasos", curto: "Atrasos", icon: <Clock3 className="size-5" />, motion: "clock" },
    { href: "/area-restrita/ranking", label: "Jornada Litúrgica", curto: "Jornada", icon: <Sparkles className="size-5" />, motion: "quiz" },
    { href: "/area-restrita/moderador/escala", label: "Gerenciar Escalas", curto: "Escalas", icon: <CalendarCheck2 className="size-5" />, motion: "scale" },
    { href: "/area-restrita/moderador/formacao", label: "Gerenciar Formação", curto: "Formação", icon: <BookOpen className="size-5" />, motion: "formation" },
    { href: "/area-restrita/moderador/presencas", label: "Controle de Presenças", curto: "Presenças", icon: <ClipboardCheck className="size-5" />, motion: "presence" },
    { href: "/area-restrita/moderador/registro", label: "Novo Registro", curto: "Registro", icon: <ClipboardPlus className="size-5" />, motion: "record" },
    { href: "/area-restrita/moderador/ranking", label: "Gerenciar Quizzes", curto: "Quizzes", icon: <BrainCircuit className="size-5" /> },
    { href: "/area-restrita/moderador/tema", label: "Cores do Site", curto: "Cores", icon: <Palette className="size-5" /> },
    { href: "/area-restrita/moderador/diagnostico", label: "Diagnóstico do Aplicativo", curto: "Diagnóstico", icon: <Bug className="size-5" />, motion: "record" },
    { href: "/escala", label: "Ver Escala", curto: "Escala pública", icon: <CalendarDays className="size-5" /> },
  ]
  return <MenuArea itens={itens} rotulo="Abrir navegação do moderador" />
}

export function MembroMenu() {
  const itens: ItemMenu[] = [
    { href: "/area-restrita/membro", label: "Meu Perfil", curto: "Meu perfil", icon: <PrayerPersonIcon className="size-5" /> },
    { href: "/area-restrita/atrasos", label: "Central de Atrasos", curto: "Atrasos", icon: <Clock3 className="size-5" />, motion: "clock" },
    { href: "/area-restrita/ranking", label: "Jornada Litúrgica", curto: "Jornada", icon: <Sparkles className="size-5" />, motion: "quiz" },
    { href: "/escala", label: "Escala do Dia", curto: "Escala", icon: <CalendarDays className="size-5" />, motion: "scale" },
    { href: "/formacao", label: "Formação", curto: "Formação", icon: <BookOpen className="size-5" />, motion: "formation" },
  ]
  return <MenuArea itens={itens} rotulo="Abrir navegação da Área Restrita" />
}