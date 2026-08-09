"use client"

import { BookOpen, ShieldCheck } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { GerenciadorFormacoes } from "@/components/gerenciador-formacoes"
import { Badge } from "@/components/ui/badge"

export function ModeradorFormacaoPage() {
  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Gerenciar Formação"
        subtitulo="Temas, avisos de cancelamento e materiais para os membros"
        voltarHref="/area-restrita/moderador"
        voltarLabel="Voltar ao painel"
        menu={<ModeradorMenu />}
        badge={
          <Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" /> Moderador
          </Badge>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <BookOpen className="size-4" /> Publique e administre as formações sem deixar o painel principal carregado.
        </div>
        <GerenciadorFormacoes />
      </main>
    </div>
  )
}
