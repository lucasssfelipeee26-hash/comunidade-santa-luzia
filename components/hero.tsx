import Image from "next/image"
import Link from "next/link"
import { BookOpenText, CalendarDays } from "lucide-react"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden border-b-2 border-[#d4af37]">
      <div className="absolute inset-0 -z-20">
        <Image
          src="/images/hero-adoracao.jpg"
          alt="Sacerdote e servidores do altar em adoração diante do Santíssimo Sacramento"
          fill
          priority
          className="object-cover object-[58%_center] sm:object-center"
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,8,12,.96)_0%,rgba(50,8,18,.86)_42%,rgba(123,19,38,.36)_72%,rgba(123,19,38,.14)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t from-black/40 to-transparent" />

      <div className="app-hero-frame mx-auto flex max-w-7xl items-end px-[var(--app-gutter)] pb-9 pt-12 sm:items-center sm:py-20">
        <div className="max-w-xl text-white sm:pt-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e9c75b] sm:mb-4 sm:text-sm sm:tracking-[0.22em]">Acólitos e Coroinhas São Padre Pio</p>
          <h1 className="text-balance font-serif text-[2.35rem] font-semibold leading-[.98] sm:text-6xl lg:text-7xl">
            Servir a Deus<br />
            <span className="text-[#e8be48]">é reinar com Ele</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-6 text-white/90 sm:mt-6 sm:text-xl sm:leading-relaxed">
            Formando corações para o altar e para a vida, com reverência, fé e amor a Jesus Eucarístico.
          </p>
          <div className="mt-6 grid max-w-sm grid-cols-1 gap-2.5 sm:mt-8 sm:flex sm:max-w-none sm:flex-wrap sm:gap-3">
            <a href="/visitante#liturgia" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d4af37] bg-[#7b1326]/92 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-[#922039] sm:px-5 sm:text-sm">
              <BookOpenText className="size-4" /> Liturgia diária
            </a>
            <Link prefetch={false} href="/escala" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#fff8e9] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#7c5810] shadow-lg transition hover:bg-white sm:px-5 sm:text-sm">
              <CalendarDays className="size-4" /> Escala do dia
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
