import { redirect } from "next/navigation"
import { RankingInterativo } from "@/components/ranking-interativo"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"
export default async function RankingPage() {
  const sessao = await lerSessao()
  if (!sessao) redirect("/area-restrita/login")
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) redirect("/area-restrita/login")
  return <RankingInterativo usuarioInicial={{ id: usuario.id, nome: usuario.nome, tipo: usuario.tipo }} />
}
