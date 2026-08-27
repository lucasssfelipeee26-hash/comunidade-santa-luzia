import Link from "next/link"
import { BookOpenText, CalendarDays, Library, LogIn, ScrollText } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { DeferredLiturgia } from "@/components/home-deferred"
import { SiteFooter } from "@/components/site-footer"
import { lerSessao } from "@/lib/auth"

const atalhos = [
  {
    id: "centro-liturgico",
    icon: BookOpenText,
    motion: "book",
    title: "Centro Litúrgico",
    text: "Liturgia das Horas, Rosário, guia da Missa e calendário litúrgico.",
    href: "/liturgia",
    cta: "Abrir centro",
  },
  {
    id: "escala-dia",
    icon: CalendarDays,
    motion: "calendar",
    title: "Escala do Dia",
    text: "Veja as escalas publicadas e as funções de cada celebração.",
    href: "/escala",
    cta: "Ver escala",
  },
  {
    id: "biblioteca",
    icon: Library,
    motion: "library",
    title: "Biblioteca",
    text: "Acesse o catálogo católico disponibilizado para consulta.",
    href: "/biblioteca",
    cta: "Abrir biblioteca",
  },
  {
    id: "liturgia-diaria",
    icon: ScrollText,
    motion: "book",
    title: "Liturgia Diária",
    text: "Consulte as leituras e o Evangelho do dia diretamente no aplicativo.",
    href: "/visitante#liturgia",
    cta: "Ler liturgia",
  },
]

export default async function VisitantePage() {
  const sessao = await lerSessao()
  const autenticado = Boolean(sessao)

  return (
    <div className="public-home min-h-screen bg-[#fffaf0]">
      <style>{`
        .sl-home-shortcut-icon svg{transform-box:fill-box;transform-origin:center;will-change:transform}
        .sl-home-shortcut-icon[data-motion="book"] svg,.sl-home-shortcut-icon[data-motion="library"] svg{animation:slHomeBook 5s ease-in-out infinite}
        .sl-home-shortcut-icon[data-motion="calendar"] svg{animation:slHomeCalendar 5.2s ease-in-out .35s infinite}
        @keyframes slHomeBook{0%,75%,100%{transform:perspective(90px) rotateY(0)}82%{transform:perspective(90px) rotateY(-18deg)}90%{transform:perspective(90px) rotateY(9deg)}}
        @keyframes slHomeCalendar{0%,76%,100%{transform:none}83%{transform:translateY(-2px) rotateX(16deg)}91%{transform:translateY(1px)}}
        @media(prefers-reduced-motion:reduce){.sl-home-shortcut-icon svg{animation:none!important}}
      `}</style>
      <SiteHeader />
      <main>
        {!autenticado && (
          <div className="border-b border-[#d4af37]/45 bg-[#fff7e5] px-3 py-1.5 text-center text-[10px] font-semibold text-[#6d4d0f] sm:px-4 sm:py-2.5 sm:text-xs">
            <span className="mr-1">Modo visitante</span>
            <span className="hidden text-[#756b5f] sm:inline">· Centro Litúrgico, Escala do Dia, Biblioteca e Liturgia Diária</span>
            <Link href="/area-restrita/login" className="ml-2 inline-flex items-center gap-1 font-bold text-[#7b1326] hover:underline">
              <LogIn className="size-3 sm:size-3.5" /> Entrar
            </Link>
          </div>
        )}

        <Hero />

        <section className="relative z-10 bg-[#fffaf0] py-4 sm:py-8" data-home-public-shortcuts="4">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-2.5 sm:gap-4 sm:px-4 lg:grid-cols-4 lg:px-6">
            {atalhos.map(({ icon: Icon, ...item }) => (
              <Link
                prefetch={false}
                key={item.id}
                href={item.href}
                data-home-shortcut-id={item.id}
                className="group min-w-0 rounded-xl border border-[#d9cfb9] bg-[#fffdf7] p-3 shadow-[0_4px_14px_rgba(72,55,21,.06)] transition active:scale-[.985] sm:rounded-2xl sm:p-5"
              >
                <span className="sl-home-shortcut-icon mb-2 flex size-9 items-center justify-center rounded-full border border-[#d4af37] bg-[#5b071b] text-[#f2cf62] shadow-sm sm:mb-4 sm:size-11" data-motion={item.motion} data-original-home-icon="true">
                  <Icon className="size-[18px] sm:size-5" />
                </span>
                <h2 className="font-serif text-[15px] font-semibold leading-tight text-[#5b071b] sm:text-xl">{item.title}</h2>
                <p className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-[#5f5a4e] sm:mt-2 sm:text-sm sm:leading-relaxed">{item.text}</p>
                <span className="mt-2 inline-block text-[8px] font-bold uppercase tracking-wide text-[#9a731d] group-hover:underline sm:mt-3 sm:text-[11px]">
                  {item.cta} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="liturgia" className="mx-auto max-w-7xl scroll-mt-20 px-3 py-6 sm:px-4 sm:py-10 lg:px-6">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#9a731d] sm:text-xs">Palavra de Deus</p>
          <h1 className="font-serif text-2xl font-semibold text-[#5b071b] sm:text-4xl">Liturgia Diária</h1>
          <p className="mb-4 mt-2 max-w-2xl text-xs leading-5 text-[#665f50] sm:mb-6 sm:mt-3 sm:text-base sm:leading-6">
            Conteúdo atualizado para preparar o coração e o serviço em cada celebração.
          </p>
          <DeferredLiturgia />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
