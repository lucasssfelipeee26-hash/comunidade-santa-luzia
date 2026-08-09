import { redirect } from "next/navigation"
import { lerSessao } from "@/lib/auth"

/**
 * Entrada da Área Restrita.
 *
 * A decisão de destino acontece no servidor, usando a sessão real do usuário.
 * Assim, moderador, acólito e coroinha nunca ficam presos em uma tela de
 * carregamento esperando o estado do React/SWR para descobrir para onde ir.
 */
export default async function AreaRestritaPage() {
  const sessao = await lerSessao()

  if (!sessao) {
    return redirect("/area-restrita/login")
  }

  if (sessao.tipo === "moderador") {
    redirect("/area-restrita/moderador")
  }

  redirect("/area-restrita/membro")
}
