import { redirect } from "next/navigation"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { GerenciadorTema } from "@/components/gerenciador-tema"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"
import { lerTemaSite } from "@/lib/site-theme"

export const dynamic = "force-dynamic"

export default async function TemaSitePage() {
  const sessao = await lerSessao()
  if (!sessao) return redirect("/area-restrita/login")
  if (sessao.tipo !== "moderador") redirect("/area-restrita/membro")

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.tipo !== "moderador") redirect("/area-restrita/login")

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Cores do Site"
        subtitulo="Temas inspirados em Santa Luzia"
        voltarHref="/area-restrita/moderador"
        voltarLabel="Voltar ao painel"
        menu={<ModeradorMenu />}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <GerenciadorTema temaInicial={lerTemaSite()} />
      </main>
    </div>
  )
}
