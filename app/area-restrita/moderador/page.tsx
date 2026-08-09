import { redirect } from "next/navigation"
import { ModeradorDashboard } from "@/components/moderador-dashboard"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function ModeradorPage() {
  const sessao = await lerSessao()

  if (!sessao) return redirect("/area-restrita/login")
  if (sessao.tipo !== "moderador") redirect("/area-restrita/membro")

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.tipo !== "moderador") redirect("/area-restrita/login")

  return <ModeradorDashboard />
}
