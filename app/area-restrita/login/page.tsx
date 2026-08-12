import { redirect } from "next/navigation"
import { Flame } from "lucide-react"
import { LoginForm } from "@/components/login-form"
import { AuthShell } from "@/components/auth-shell"
import { lerSessao } from "@/lib/auth"

export default async function LoginPage() {
  const sessao = await lerSessao()

  if (sessao?.tipo === "moderador") redirect("/area-restrita/moderador")
  if (sessao?.tipo === "membro") redirect("/area-restrita/membro")

  return (
    <AuthShell
      icon={<Flame className="size-6" aria-hidden="true" />}
      titulo="Bem-vindo ao Santa Luzia"
      subtitulo="Entre para abrir seu painel ou continue como visitante"
      rodape="Seu acesso permanece neste aparelho até você sair ou instalar uma nova versão do aplicativo."
    >
      <LoginForm />
    </AuthShell>
  )
}
