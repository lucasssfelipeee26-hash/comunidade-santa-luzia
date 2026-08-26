"use client"

import { AreaHeader } from "@/components/area-header"
import { MembroMenu, ModeradorMenu } from "@/components/area-menu"
import { EquipeNoPainel } from "@/components/equipe-no-painel"

type Props = { tipoUsuario: "membro" | "moderador" }

export function PerfisEquipe({ tipoUsuario }: Props) {
  const menu = tipoUsuario === "moderador" ? <ModeradorMenu /> : <MembroMenu />
  const voltar = tipoUsuario === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro"

  return (
    <div className="min-h-screen bg-background" data-profiles-page="status-model">
      <AreaHeader
        titulo="Perfis da equipe"
        subtitulo="Deslize pelas fotos ou pesquise pelo nome"
        voltarHref={voltar}
        menu={menu}
      />
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-5 pb-24 sm:px-4 sm:py-8">
        <EquipeNoPainel />
      </main>
    </div>
  )
}
