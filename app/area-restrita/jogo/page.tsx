import { redirect } from "next/navigation"
import { CaminhoDaLuzGame } from "@/components/caminho-da-luz-game"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function JogoPage() {
  const sessao = await lerSessao()
  if (!sessao) redirect("/area-restrita/login")
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) redirect("/area-restrita/login")
  return <CaminhoDaLuzGame tipoUsuario={usuario.tipo} />
}
