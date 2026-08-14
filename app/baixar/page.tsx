import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CloudDownload, RefreshCw, Wifi } from "lucide-react"
import { AndroidDownloadCard } from "@/components/android-download-card"

export const metadata: Metadata = {
  title: "Baixar aplicativo Android · Santa Luzia",
  description: "Baixe gratuitamente o aplicativo Android da Comunidade Santa Luzia.",
}

export default function BaixarAplicativoPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff2cf_0%,#fffaf0_35%,#fff_72%)] px-4 py-8 text-[#342a2c] sm:py-14">
      <div className="mx-auto max-w-4xl">
        <Link href="/visitante" className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#7b1326] shadow-sm"><ArrowLeft className="size-4" /> Voltar</Link>

        <section className="py-9 text-center sm:py-12">
          <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-[#7b1326] text-[#ffe08a] shadow-[0_14px_35px_rgba(123,19,38,.24)]"><CloudDownload className="size-8" /></span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.24em] text-[#9a731d]">Download oficial</p>
          <h1 className="mt-2 text-balance font-serif text-4xl font-semibold text-[#681225] sm:text-6xl">Instale o aplicativo Santa Luzia</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#675d5e] sm:text-base">Um aplicativo Android de verdade, disponível gratuitamente e atualizado diretamente pela Comunidade.</p>
        </section>

        <div className="mx-auto max-w-xl"><AndroidDownloadCard /></div>

        <section className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e4d8cb] bg-white/80 p-5"><Wifi className="size-6 text-[#0b6b4b]" /><h2 className="mt-3 font-serif text-xl font-semibold text-[#173d2d]">Conteúdo pelo servidor</h2><p className="mt-1 text-sm leading-6 text-[#6b6260]">Quando houver internet, o aplicativo sincroniza escalas, avisos e conteúdos novos.</p></div>
          <div className="rounded-2xl border border-[#e4d8cb] bg-white/80 p-5"><RefreshCw className="size-6 text-[#7b1326]" /><h2 className="mt-3 font-serif text-xl font-semibold text-[#681225]">Atualizações modernas</h2><p className="mt-1 text-sm leading-6 text-[#6b6260]">Uma tela dentro do app avisa quando uma nova versão do APK estiver disponível.</p></div>
        </section>
      </div>
    </main>
  )
}
