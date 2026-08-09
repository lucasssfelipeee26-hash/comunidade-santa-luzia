"use client"

import { CalendarDays, ShieldCheck } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { EditorEscala } from "@/components/editor-escala"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"

export function ModeradorEscalaPage() {
  const { membros } = useStore()

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Montar Escala do Dia"
        subtitulo="Organize celebrante, acólitos, coroinhas e funções"
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
          <CalendarDays className="size-4" /> Esta função agora fica separada do painel principal e pode ser aberta pelo menu ☰.
        </div>
        <EditorEscala membros={membros} />
      </main>
    </div>
  )
}
