import { redirect } from "next/navigation"
import { ModeradorEscalaPage } from "@/components/moderador-escala-page"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function Page() {
  const sessao = await lerSessao()
  if (!sessao) return redirect("/area-restrita/login")
  if (sessao.tipo !== "moderador") redirect("/area-restrita/membro")
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.tipo !== "moderador") redirect("/area-restrita/login")
  return <ModeradorEscalaPage />
}
