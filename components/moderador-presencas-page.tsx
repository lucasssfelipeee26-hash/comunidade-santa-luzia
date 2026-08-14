"use client"

import { ClipboardCheck, ShieldCheck } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { ControlePresencasFormacao } from "@/components/controle-presencas-formacao"
import { Badge } from "@/components/ui/badge"

export function ModeradorPresencasPage() {
  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Controle de Presenças"
        subtitulo="Formações, faltas, justificativas e histórico da equipe"
        voltarHref="/area-restrita/moderador"
        voltarLabel="Voltar ao painel"
        menu={<ModeradorMenu />}
        badge={
          <Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" /> Moderador
          </Badge>
        }
      />
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <ClipboardCheck className="size-4 shrink-0" />
          Cada moderador registra apenas a própria presença; acólitos e coroinhas podem ser corrigidos pela moderação.
        </div>
        <ControlePresencasFormacao />
      </main>
    </div>
  )
}
