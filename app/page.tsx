import Link from "next/link"
import { BookOpen, CalendarDays, Church, Heart, Users } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"
import { CalendarioLiturgico } from "@/components/calendario-liturgico"
import { Contato } from "@/components/contato"
import { SiteFooter } from "@/components/site-footer"

const atalhos = [
  { icon: Church, title: "Quem Somos", text: "Conheça nossa missão, história e o carisma de servir a Deus com amor e dedicação.", href: "#comunidade", cta: "Saiba mais" },
  { icon: CalendarDays, title: "Escala do Dia", text: "Confira quem está servindo nas celebrações: sacerdote, acólitos e coroinhas.", href: "/escala", cta: "Ver escala" },
  { icon: BookOpen, title: "Formação", text: "Conteúdos para crescer na fé, na reverência e no serviço ao altar do Senhor.", href: "/formacao", cta: "Acessar" },
  { icon: Heart, title: "Seja um Membro", text: "Faça parte desta missão e descubra a alegria de servir a Jesus e à Igreja.", href: "/area-restrita/cadastro", cta: "Quero participar" },
]

function SectionTitle({ overline, title, description }: { overline: string; title: string; description?: string }) {
  return <div className="mb-8 max-w-2xl"><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#9a731d]">{overline}</p><h2 className="font-serif text-4xl font-semibold text-[#0b4b35] sm:text-5xl">{title}</h2>{description && <p className="mt-3 leading-relaxed text-[#665f50]">{description}</p>}</div>
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main>
        <Hero />

        <section className="relative z-10 bg-[#fffaf0] py-9">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            {atalhos.map(({ icon: Icon, ...item }) => (
              <Link key={item.title} href={item.href} className="group rounded-xl border border-[#d9cfb9] bg-[#fffdf7] p-6 shadow-[0_8px_24px_rgba(72,55,21,.08)] transition hover:-translate-y-1 hover:border-[#d4af37] hover:shadow-lg">
                <span className="mb-5 flex size-12 items-center justify-center rounded-full border border-[#d4af37] bg-[#073b29] text-[#f2cf62]"><Icon className="size-6" /></span>
                <h3 className="font-serif text-2xl font-semibold text-[#173d2d]">{item.title}</h3>
                <p className="mt-2 min-h-20 text-sm leading-relaxed text-[#5f5a4e]">{item.text}</p>
                <span className="mt-4 inline-block text-xs font-bold uppercase tracking-wide text-[#9a731d] group-hover:underline">{item.cta} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="comunidade" className="scroll-mt-24 border-y-2 border-[#d4af37] bg-[#073b29] py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-2 lg:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e9c75b]">Nossa Missão</p>
              <h2 className="mt-2 font-serif text-4xl text-[#f2cf62]">Servir com reverência e alegria</h2>
              <p className="mt-5 max-w-xl leading-8 text-white/82">Formar acólitos e coroinhas segundo o coração de Deus, para que, com fé, disciplina e caridade, sirvam ao altar, à Igreja e aos irmãos. Nosso grupo é confiado à intercessão de São Padre Pio e à proteção de Santa Luzia.</p>
              <blockquote className="mt-7 max-w-xl rounded-lg border border-[#d4af37]/60 bg-white/5 p-5 text-sm leading-relaxed text-white/86"><strong className="text-[#f2cf62]">“Tudo o que fizerem, façam de coração, como para o Senhor e não para os homens.”</strong><br /><span className="mt-2 inline-block text-[#e9c75b]">Colossenses 3,23</span></blockquote>
            </div>
            <div id="formacao" className="rounded-xl border border-[#d4af37]/45 bg-[#0a4733] p-7">
              <div className="flex items-center gap-3"><Users className="size-7 text-[#f2cf62]" /><h3 className="font-serif text-3xl text-[#f2cf62]">Formação e vida comunitária</h3></div>
              <p className="mt-4 leading-7 text-white/80">O serviço no presbitério exige preparação espiritual, conhecimento da liturgia e compromisso com a comunidade. A área restrita reúne os membros aprovados e facilita a organização do grupo.</p>
              <Link href="/area-restrita/cadastro" className="mt-6 inline-flex rounded-md border border-[#d4af37] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#f2cf62] hover:bg-[#d4af37] hover:text-[#073b29]">Solicitar cadastro</Link>
            </div>
          </div>
        </section>

        <section id="liturgia" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 lg:px-6">
          <SectionTitle overline="Palavra de Deus" title="Liturgia Diária" description="Acompanhe as leituras e o Evangelho do dia para preparar também o coração para cada celebração." />
          <LiturgiaDiaria />
        </section>

        <section id="calendario" className="scroll-mt-24 border-y border-[#d9cfb9] bg-[#f6efdf] py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <SectionTitle overline="Ano Litúrgico" title="Calendário Litúrgico" description="Conheça os tempos e as cores da Igreja ao longo do ano." />
            <CalendarioLiturgico />
          </div>
        </section>

        <section className="border-b border-[#d9cfb9] bg-[#fffaf0] py-14">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-2 lg:px-6">
            <div className="rounded-xl border border-[#d4af37]/35 bg-white/55 p-7"><p className="font-serif text-3xl text-[#0b4b35]">Rogai a Deus por nós!</p><p className="mt-3 leading-7 text-[#625c50]">Peçamos a intercessão de São Padre Pio e de Santa Luzia para que nossos servidores sejam fiéis, humildes e cheios de amor a Jesus Eucarístico.</p></div>
            <div className="flex items-center rounded-xl border border-[#d4af37]/35 bg-[#f3ead5] p-7"><p className="font-serif text-2xl italic leading-relaxed text-[#234535]">“A Eucaristia seja o centro do nosso serviço e da nossa vida.”<span className="mt-2 block text-base not-italic text-[#9a731d]">— espiritualidade de São Padre Pio</span></p></div>
          </div>
        </section>

        <section id="contato" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 lg:px-6">
          <SectionTitle overline="Venha nos visitar" title="Contato e Localização" description="Comunidade Santa Luzia · Paróquia Nossa Senhora das Graças." />
          <Contato />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
