import { KeyRound } from "lucide-react"
import { RecuperarSenhaForm } from "@/components/recuperar-senha-form"
import { AuthShell } from "@/components/auth-shell"
import { site } from "@/lib/site"

export default function RecuperarSenhaPage() {
  return (
    <AuthShell
      icon={<KeyRound className="size-6" aria-hidden="true" />}
      titulo="Recuperar senha"
      subtitulo={`Área restrita da ${site.comunidade}`}
      voltarHref="/area-restrita/login"
      voltarLabel="Voltar ao login"
    >
      <RecuperarSenhaForm />
    </AuthShell>
  )
}
