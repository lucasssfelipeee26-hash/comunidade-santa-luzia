"use client"

import {
  TriangleAlert,
  FileText,
  CalendarX,
  NotebookPen,
  ShieldCheck,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { RegistroCard } from "@/components/registro-card"
import { useStore, type Membro } from "@/lib/store"

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

export function PerfilModerador({ membro }: { membro: Membro }) {
  const { removerRegistro } = useStore()

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo={membro.nome}
        subtitulo={`${membro.funcao} · na equipe desde ${membro.desde || "data não informada"}`}
        voltarHref="/area-restrita/moderador"
        voltarLabel="Todos os perfis"
        menu={<ModeradorMenu />}
        badge={
          <Avatar className="size-11 border-2 border-accent/60">
            <AvatarImage src={membro.foto || undefined} />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {iniciais(membro.nome)}
            </AvatarFallback>
          </Avatar>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-accent/45 bg-accent/10 px-4 py-3 text-sm text-primary">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Você está na visão do moderador. Para criar uma advertência, falta ou observação, use o menu ☰ e escolha Novo Registro.
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <RegistroCard
            titulo="Advertências"
            icon={<TriangleAlert className="size-4 text-white" aria-hidden="true" />}
            accent="bg-destructive"
            itens={membro.advertencias}
            vazio="Nenhuma advertência registrada."
            onRemover={(rid) => removerRegistro(membro.id, "advertencias", rid)}
          />
          <RegistroCard
            titulo="Faltas"
            icon={<CalendarX className="size-4 text-secondary-foreground" aria-hidden="true" />}
            accent="bg-secondary"
            itens={membro.faltas}
            vazio="Nenhuma falta registrada."
            onRemover={(rid) => removerRegistro(membro.id, "faltas", rid)}
          />
          <RegistroCard
            titulo="Justificativas"
            icon={<FileText className="size-4 text-white" aria-hidden="true" />}
            accent="bg-primary"
            itens={membro.justificativas}
            vazio="O membro ainda não enviou justificativas."
            onRemover={(rid) => removerRegistro(membro.id, "justificativas", rid)}
          />
          <RegistroCard
            titulo="Observações"
            icon={<NotebookPen className="size-4 text-accent-foreground" aria-hidden="true" />}
            accent="bg-accent"
            itens={membro.observacoes}
            vazio="Nenhuma observação registrada."
            onRemover={(rid) => removerRegistro(membro.id, "observacoes", rid)}
          />
        </div>
      </main>
    </div>
  )
}
