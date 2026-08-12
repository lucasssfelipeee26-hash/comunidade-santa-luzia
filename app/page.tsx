import { redirect } from "next/navigation"
import { lerSessao } from "@/lib/auth"

/**
 * Porta de entrada do aplicativo.
 *
 * - sessão válida de moderador -> painel do moderador
 * - sessão válida de membro -> painel do membro
 * - sem sessão -> login imediatamente
 *
 * O modo visitante fica disponível como escolha explícita na tela de login.
 */
export default async function AppStartPage() {
  const sessao = await lerSessao()

  if (sessao?.tipo === "moderador") {
    redirect("/area-restrita/moderador")
  }

  if (sessao?.tipo === "membro") {
    redirect("/area-restrita/membro")
  }

  redirect("/area-restrita/login")
}
