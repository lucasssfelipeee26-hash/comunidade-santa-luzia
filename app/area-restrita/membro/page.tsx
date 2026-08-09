import { redirect } from "next/navigation"
import { MembroAreaContent } from "@/components/membro-area-content"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function MembroPage() {
  const sessao = await lerSessao()

  if (!sessao) return redirect("/area-restrita/login")
  if (sessao.tipo === "moderador") redirect("/area-restrita/moderador")

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.tipo !== "membro" || usuario.status !== "aprovado") {
    redirect("/area-restrita/login")
  }

  return <MembroAreaContent />
}
