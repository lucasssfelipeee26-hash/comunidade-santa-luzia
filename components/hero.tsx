import Image from "next/image"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate aspect-[90/31] overflow-hidden border-b-2 border-[#d4af37] bg-[#27070d] sm:aspect-auto" data-hero-clean-image="true" data-hero-mobile-framed="true">
      <div className="absolute inset-0 -z-20 bg-[#27070d]">
        <Image
          src="/images/hero-adoracao.jpg"
          alt="Sacerdote e servidores do altar em adoração diante do Santíssimo Sacramento"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(28,8,12,.86)_0%,rgba(50,8,18,.54)_34%,rgba(123,19,38,.10)_67%,rgba(0,0,0,0)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-10 bg-gradient-to-t from-black/22 to-transparent sm:h-20" />

      <div className="absolute inset-0 mx-auto flex w-full max-w-7xl items-end px-[var(--app-gutter)] pb-3 pt-2 sm:static sm:min-h-[360px] sm:items-center sm:py-10 lg:min-h-[420px]">
        <div className="max-w-[19rem] text-white sm:max-w-xl">
          <p className="mb-1 text-[7px] font-semibold uppercase tracking-[0.15em] text-[#e9c75b] sm:mb-3 sm:text-xs sm:tracking-[0.2em]">Acólitos e Coroinhas São Padre Pio</p>
          <h1 className="text-balance font-serif text-[1.55rem] font-semibold leading-[.98] drop-shadow-sm sm:text-5xl lg:text-6xl">
            Servir a Deus<br />
            <span className="text-[#e8be48]">é reinar com Ele</span>
          </h1>
          <p className="mt-2 hidden max-w-lg text-sm leading-5 text-white/90 sm:block sm:text-base sm:leading-relaxed lg:text-lg">
            Formando corações para o altar e para a vida, com reverência, fé e amor a Jesus Eucarístico.
          </p>
        </div>
      </div>
    </section>
  )
}
