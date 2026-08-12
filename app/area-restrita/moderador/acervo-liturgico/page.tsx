import { redirect } from "next/navigation"
import { ImportarAcervoLiturgico } from "@/components/importar-acervo-liturgico"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AcervoLiturgicoModeradorPage() {
  const sessao = await lerSessao()
  if (!sessao) redirect("/area-restrita/login")
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.tipo !== "moderador") redirect("/area-restrita/login")

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <AreaHeader titulo="Acervo Litúrgico Offline" subtitulo="Instalação e atualização da biblioteca autorizada" voltarHref="/area-restrita/moderador" menu={<ModeradorMenu />} />
      <main className="mx-auto max-w-5xl px-3 py-5 pb-24 sm:px-4 sm:py-8">
        <ImportarAcervoLiturgico />
      </main>
    </div>
  )
}
