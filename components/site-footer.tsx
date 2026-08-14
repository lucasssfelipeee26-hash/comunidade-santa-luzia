import Image from "next/image"
import Link from "next/link"
import { Download, Lock, MapPin } from "lucide-react"
import { site } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-[#d4af37] bg-[#073b29] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-11 md:grid-cols-[1.3fr_1fr_1fr] lg:px-6">
        <div className="flex gap-4">
          <span className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-[#d4af37]">
            <Image src="/images/santa-luzia-logo.jpg" alt="Santa Luzia" fill className="object-cover" sizes="80px" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-[#e9c75b]">Comunidade</p>
            <p className="font-serif text-2xl font-bold uppercase text-[#f2cf62]">Santa Luzia</p>
            <p className="text-sm font-semibold uppercase">Acólitos e Coroinhas São Padre Pio</p>
            <p className="mt-1 text-xs uppercase text-white/65">{site.paroquia}</p>
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-serif text-xl text-[#f2cf62]">Endereço</h4>
          <div className="flex gap-2 text-sm leading-relaxed text-white/82">
            <MapPin className="mt-1 size-4 shrink-0 text-[#e9c75b]" />
            <address className="not-italic">999, {site.endereco.rua}<br />{site.endereco.bairro}, {site.endereco.cidade} — {site.endereco.estado}<br />CEP {site.endereco.cep}</address>
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-serif text-xl text-[#f2cf62]">Serviço ao altar</h4>
          <p className="text-sm leading-relaxed text-white/78">Liturgia diária, escala das celebrações, biblioteca e acesso dos membros.</p>
          <Link href="/area-restrita/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#f2cf62] hover:underline">
            <Lock className="size-4" /> Entrar
          </Link>
          <Link href="/baixar" className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#f2cf62] hover:underline">
            <Download className="size-4" /> Baixar aplicativo Android
          </Link>
        </div>
      </div>
      <div className="border-t border-[#d4af37]/30 bg-[#052f21]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-5 text-center text-xs text-white/60"><span>© {new Date().getFullYear()} {site.comunidade} · {site.grupo} · {site.paroquia}. Todos os direitos reservados.</span><Link href="/privacidade" className="text-white/80 hover:text-white hover:underline">Privacidade</Link><Link href="/excluir-conta" className="text-white/80 hover:text-white hover:underline">Excluir conta</Link></div>
      </div>
    </footer>
  )
}
