import Link from "next/link"
import { BookOpenText, CalendarDays, Library, LogIn, UserPlus } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { DeferredLiturgia } from "@/components/home-deferred"
import { SiteFooter } from "@/components/site-footer"
import { lerSessao } from "@/lib/auth"

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

export default async function VisitantePage() {
  const sessao = await lerSessao()
  const autenticado = Boolean(sessao)
  const atalhosVisiveis = autenticado ? atalhos.filter((item) => item.href !== "/area-restrita/cadastro") : atalhos

  return (
    <div className="public-home min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main>
        {!autenticado && (
          <div className="border-b border-[#d4af37]/45 bg-[#fff7e5] px-3 py-1.5 text-center text-[10px] font-semibold text-[#6d4d0f] sm:px-4 sm:py-2.5 sm:text-xs">
            <span className="mr-1">Modo visitante</span>
            <span className="hidden text-[#756b5f] sm:inline">· Centro Litúrgico, Escala do Dia e Biblioteca</span>
            <Link href="/area-restrita/login" className="ml-2 inline-flex items-center gap-1 font-bold text-[#7b1326] hover:underline">
              <LogIn className="size-3 sm:size-3.5" /> Entrar
            </Link>
          </div>
        )}

        <Hero />

        <section className="relative z-10 bg-[#fffaf0] py-4 sm:py-8">
          <div className={`mx-auto grid max-w-7xl grid-cols-2 gap-2 px-2.5 sm:gap-4 sm:px-4 lg:px-6 ${atalhosVisiveis.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {atalhosVisiveis.map(({ icon: Icon, ...item }) => (
              <Link
                prefetch={false}
                key={item.title}
                href={item.href}
                className="group min-w-0 rounded-xl border border-[#d9cfb9] bg-[#fffdf7] p-3 shadow-[0_4px_14px_rgba(72,55,21,.06)] transition active:scale-[.985] sm:rounded-2xl sm:p-5"
              >
                <span className="mb-2 flex size-9 items-center justify-center rounded-xl border border-[#d4af37] bg-[#073b29] text-[#f2cf62] sm:mb-4 sm:size-11 sm:rounded-full">
                  <Icon className="size-[18px] sm:size-5" />
                </span>
                <h2 className="font-serif text-[15px] font-semibold leading-tight text-[#173d2d] sm:text-xl">{item.title}</h2>
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
          <h1 className="font-serif text-2xl font-semibold text-[#0b4b35] sm:text-4xl">Liturgia Diária</h1>
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
