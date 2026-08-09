import { redirect } from "next/navigation"
import { lerSessao } from "@/lib/auth"
import { AreaHeader } from "@/components/area-header"
import { FormacaoMembros } from "@/components/formacao-membros"

export default async function FormacaoPage() {
  const sessao = await lerSessao()
  if (!sessao) return redirect("/area-restrita/login?destino=/formacao")
  return <div className="min-h-screen bg-[#fffaf0]">
    <AreaHeader titulo="Formação" subtitulo="Conteúdos, temas e avisos para acólitos e coroinhas" voltarHref={sessao.tipo === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro"} />
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 rounded-xl border border-[#d4af37]/35 bg-[#073b29] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e9c75b]">Acólitos e Coroinhas São Padre Pio</p><h1 className="mt-2 font-serif text-4xl text-[#f2cf62]">Central de Formação</h1><p className="mt-3 max-w-3xl text-white/80">Veja o tema da próxima formação, eventuais avisos de cancelamento e baixe os materiais disponibilizados pelo moderador.</p></div>
      <FormacaoMembros />
    </main>
  </div>
}
