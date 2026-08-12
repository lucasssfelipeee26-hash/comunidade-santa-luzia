import Link from "next/link"
import { BookOpenText, CalendarDays, Library, LogIn, UserPlus } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { DeferredLiturgia } from "@/components/home-deferred"
import { SiteFooter } from "@/components/site-footer"

const atalhos = [
  {
    icon: BookOpenText,
    title: "Centro Litúrgico",
    text: "Liturgia diária, Liturgia das Horas, Rosário, guia da Missa e calendário.",
    href: "/liturgia",
    cta: "Abrir centro",
  },
  {
    icon: CalendarDays,
    title: "Escala do Dia",
    text: "Veja as escalas publicadas e as funções de cada celebração.",
    href: "/escala",
    cta: "Ver escala",
  },
  {
    icon: Library,
    title: "Biblioteca",
    text: "Acesse o catálogo católico disponibilizado para consulta.",
    href: "/biblioteca",
    cta: "Abrir biblioteca",
  },
  {
    icon: UserPlus,
    title: "Quero participar",
    text: "Acólitos e coroinhas podem solicitar cadastro para a área restrita.",
    href: "/area-restrita/cadastro",
    cta: "Solicitar acesso",
  },
]

export default function VisitantePage() {
  return (
    <div className="public-home min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main>
        <div className="border-b border-[#d4af37]/45 bg-[#fff7e5] px-4 py-2.5 text-center text-xs font-semibold text-[#6d4d0f]">
          <span className="mr-1">Modo visitante</span>
          <span className="text-[#756b5f]">· Centro Litúrgico, Escala do Dia e Biblioteca</span>
          <Link href="/area-restrita/login" className="ml-2 inline-flex items-center gap-1 font-bold text-[#7b1326] hover:underline">
            <LogIn className="size-3.5" /> Entrar
          </Link>
        </div>

        <Hero />

        <section className="relative z-10 bg-[#fffaf0] py-8 sm:py-10">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-3 sm:gap-4 sm:px-4 lg:grid-cols-4 lg:px-6">
            {atalhos.map(({ icon: Icon, ...item }) => (
              <Link
                prefetch={false}
                key={item.title}
                href={item.href}
                className="group min-w-0 rounded-2xl border border-[#d9cfb9] bg-[#fffdf7] p-4 shadow-[0_6px_20px_rgba(72,55,21,.07)] transition active:scale-[.985] sm:p-6"
              >
                <span className="mb-3 flex size-10 items-center justify-center rounded-2xl border border-[#d4af37] bg-[#073b29] text-[#f2cf62] sm:mb-5 sm:size-12 sm:rounded-full">
                  <Icon className="size-5 sm:size-6" />
                </span>
                <h2 className="font-serif text-lg font-semibold leading-tight text-[#173d2d] sm:text-2xl">{item.title}</h2>
                <p className="mt-2 text-xs leading-5 text-[#5f5a4e] sm:text-sm sm:leading-relaxed">{item.text}</p>
                <span className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wide text-[#9a731d] group-hover:underline sm:text-xs">
                  {item.cta} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="liturgia" className="mx-auto max-w-7xl scroll-mt-24 px-3 py-10 sm:px-4 sm:py-14 lg:px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#9a731d]">Palavra de Deus</p>
          <h1 className="font-serif text-3xl font-semibold text-[#0b4b35] sm:text-5xl">Liturgia Diária</h1>
          <p className="mb-6 mt-3 max-w-2xl text-sm leading-6 text-[#665f50] sm:text-base">
            Conteúdo atualizado para preparar o coração e o serviço em cada celebração.
          </p>
          <DeferredLiturgia />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
