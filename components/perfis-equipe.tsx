"use client"

import { AreaHeader } from "@/components/area-header"
import { MembroMenu, ModeradorMenu } from "@/components/area-menu"
import { EquipeNoPainel } from "@/components/equipe-no-painel"

type Props = { tipoUsuario: "membro" | "moderador" }

export function PerfisEquipe({ tipoUsuario }: Props) {
  const menu = tipoUsuario === "moderador" ? <ModeradorMenu /> : <MembroMenu />
  const voltar = tipoUsuario === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro"

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Equipe"
        subtitulo="Perfis públicos dos acólitos e coroinhas"
        voltarHref={voltar}
        menu={menu}
      />
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-5 pb-24 sm:px-4 sm:py-8">
        <div className="mb-4 rounded-2xl border border-primary/10 bg-primary/[.035] px-4 py-3 text-sm leading-5 text-muted-foreground">
          A equipe também aparece diretamente no painel principal. Esta tela continua disponível apenas para compatibilidade com links antigos.
        </div>
        <EquipeNoPainel />
      </main>
    </div>
  )
}
