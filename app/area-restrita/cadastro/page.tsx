import { UserPlus } from "lucide-react"
import { CadastroForm } from "@/components/cadastro-form"
import { AuthShell } from "@/components/auth-shell"
import { site } from "@/lib/site"

export default function CadastroPage() {
  return (
    <AuthShell
      icon={<UserPlus className="size-6" aria-hidden="true" />}
      titulo="Cadastro de Acólito / Coroinha"
      subtitulo={`Solicite seu acesso à área restrita da ${site.comunidade}`}
      voltarHref="/area-restrita/login"
      voltarLabel="Voltar ao login"
    >
      <p className="mb-6 text-pretty text-sm leading-relaxed text-muted-foreground">
        Preencha seus dados abaixo. O moderador da equipe precisa aprovar o cadastro antes que
        você possa entrar.
      </p>
      <CadastroForm />
    </AuthShell>
  )
}
