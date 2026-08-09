import { Flame } from "lucide-react"
import { LoginForm } from "@/components/login-form"
import { AuthShell } from "@/components/auth-shell"

export default function LoginPage() {
  return (
    <AuthShell
      icon={<Flame className="size-6" aria-hidden="true" />}
      titulo="Área Restrita"
      subtitulo="Acesso de moderador, acólitos e coroinhas"
      voltarHref="/"
      rodape="Problemas para acessar? Fale com o moderador da equipe de acólitos."
    >
      <LoginForm />
    </AuthShell>
  )
}
