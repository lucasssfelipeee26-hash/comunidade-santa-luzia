import Image from "next/image"
import Link from "next/link"
import { BookOpenText, CalendarDays } from "lucide-react"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden border-b-2 border-[#d4af37] bg-[#27070d]">
      {/*
        A imagem original tem composição panorâmica. `object-cover` cortava o
        banner no Android. Mantemos o arquivo original e usamos `object-contain`
        para que 100% da imagem fique visível em qualquer largura de tela.
      */}
      <div className="absolute inset-0 -z-20 bg-[#27070d]">
        <Image
          src="/images/hero-adoracao.jpg"
          alt="Sacerdote e servidores do altar em adoração diante do Santíssimo Sacramento"
          fill
          priority
          className="object-contain object-center"
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,8,12,.9)_0%,rgba(50,8,18,.68)_36%,rgba(123,19,38,.18)_68%,rgba(0,0,0,.04)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-14 bg-gradient-to-t from-black/28 to-transparent sm:h-20" />

      <div className="mx-auto flex min-h-[230px] max-w-7xl items-end px-[var(--app-gutter)] pb-4 pt-4 sm:min-h-[360px] sm:items-center sm:py-10 lg:min-h-[420px]">
        <div className="max-w-[19rem] text-white sm:max-w-xl">
          <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#e9c75b] sm:mb-3 sm:text-xs sm:tracking-[0.2em]">Acólitos e Coroinhas São Padre Pio</p>
          <h1 className="text-balance font-serif text-[1.7rem] font-semibold leading-[.98] drop-shadow-sm sm:text-5xl lg:text-6xl">
            Servir a Deus<br />
            <span className="text-[#e8be48]">é reinar com Ele</span>
          </h1>
          <p className="mt-2 hidden max-w-lg text-sm leading-5 text-white/90 sm:block sm:text-base sm:leading-relaxed lg:text-lg">
            Formando corações para o altar e para a vida, com reverência, fé e amor a Jesus Eucarístico.
          </p>
          <div className="mt-3 flex max-w-[19rem] gap-2 sm:mt-5 sm:max-w-none sm:flex-wrap">
            <a href="/liturgia" className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d4af37] bg-[#7b1326]/92 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide text-white shadow-md transition hover:bg-[#922039] sm:flex-none sm:px-4 sm:text-xs">
              <BookOpenText className="size-3.5 sm:size-4" /> Liturgia diária
            </a>
            <Link prefetch={false} href="/escala" className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#fff8e9] px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide text-[#7c5810] shadow-md transition hover:bg-white sm:flex-none sm:px-4 sm:text-xs">
              <CalendarDays className="size-3.5 sm:size-4" /> Escala do dia
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
