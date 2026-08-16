import { redirect } from "next/navigation"
import { PerfisEquipe } from "@/components/perfis-equipe"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function PerfisEquipePage() {
  const sessao = await lerSessao()
  if (!sessao) redirect("/area-restrita/login")
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.status !== "aprovado") redirect("/area-restrita/login")
  return <PerfisEquipe tipoUsuario={sessao.tipo} />
}
