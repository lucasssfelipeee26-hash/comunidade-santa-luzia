import Image from "next/image"
import Link from "next/link"
import { CalendarDays, Users } from "lucide-react"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden border-b-2 border-[#d4af37]">
      <div className="absolute inset-0 -z-20">
        <Image
          src="/images/hero-adoracao.jpg"
          alt="Sacerdote e servidores do altar em adoração diante do Santíssimo Sacramento"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,8,12,.95)_0%,rgba(50,8,18,.82)_32%,rgba(123,19,38,.36)_60%,rgba(123,19,38,.14)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 -z-10 bg-gradient-to-t from-black/35 to-transparent" />

      <div className="mx-auto flex min-h-[620px] max-w-7xl items-center px-4 py-20 lg:px-6">
        <div className="max-w-xl pt-4 text-white">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#e9c75b]">Acólitos e Coroinhas São Padre Pio</p>
          <h1 className="text-balance font-serif text-5xl font-semibold leading-[.98] sm:text-6xl lg:text-7xl">
            Servir a Deus<br />
            <span className="text-[#e8be48]">é reinar com Ele</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/88 sm:text-xl">
            Formando corações para o altar e para a vida, com reverência, fé e amor a Jesus Eucarístico.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#comunidade" className="inline-flex items-center gap-2 rounded-md border border-[#d4af37] bg-[#073b29]/90 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-[#0b5038]">
              <Users className="size-4" /> Conheça a comunidade
            </a>
            <Link href="/escala" className="inline-flex items-center gap-2 rounded-md bg-[#fff8e9] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#7c5810] shadow-lg transition hover:bg-white">
              <CalendarDays className="size-4" /> Escala do dia
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
