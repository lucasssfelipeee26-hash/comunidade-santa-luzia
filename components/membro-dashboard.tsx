"use client"

import Link from "next/link"
import { useState } from "react"
import {
  TriangleAlert,
  FileText,
  CalendarX,
  NotebookPen,
  CheckCircle2,
  Send,
  Lock,
  BookOpen,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileSettings } from "@/components/profile-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AreaHeader } from "@/components/area-header"
import { MembroMenu } from "@/components/area-menu"
import { Badge } from "@/components/ui/badge"
import { RegistroCard } from "@/components/registro-card"
import { useStore, type Membro } from "@/lib/store"

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
}

export function MembroDashboard({ membro }: { membro: Membro }) {
  const { adicionarJustificativa } = useStore()
  const [data, setData] = useState(hojeISO())
  const [motivo, setMotivo] = useState("")
  const [enviado, setEnviado] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data || motivo.trim().length < 3) return
    adicionarJustificativa(membro.id, data, motivo.trim())
    setMotivo("")
    setEnviado(true)
    setTimeout(() => setEnviado(false), 4000)
  }

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Meu Perfil"
        subtitulo={`${membro.funcao} · na equipe desde ${membro.desde || "data não informada"}`}
        voltarHref="/"
        menu={<MembroMenu />}
        badge={
          <Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">
            Acesso liberado
          </Badge>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <ProfileSettings />
        <Link href="/formacao" className="mb-6 flex items-center justify-between rounded-xl border border-accent/45 bg-card p-5 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
          <div><p className="flex items-center gap-2 font-serif text-xl text-primary"><BookOpen className="size-5" /> Central de Formação</p><p className="mt-1 text-sm text-muted-foreground">Veja o tema do próximo encontro, avisos de cancelamento e materiais para download.</p></div>
          <span className="font-semibold text-primary">Acessar →</span>
        </Link>

        <div className="mb-8 flex items-center gap-4 rounded-xl border border-border bg-card p-5">
          <Avatar className="size-16 border-2 border-primary/30">
            <AvatarImage src={membro.foto || undefined} /><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{iniciais(membro.nome)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">{membro.nome}</h2>
            <p className="text-sm text-muted-foreground">{membro.funcao}</p>
          </div>
        </div>

        {/* Justificar ausência — única ação de escrita do membro */}
        <section className="mb-8 overflow-hidden rounded-xl border border-primary/30 bg-card">
          <header className="border-b border-border bg-primary/5 px-5 py-4">
            <h3 className="flex items-center gap-2 font-serif text-xl text-primary">
              <FileText className="size-5" aria-hidden="true" />
              Justificar uma ausência
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe a data e o motivo. Sua justificativa fica registrada no seu perfil para o
              moderador avaliar.
            </p>
          </header>
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="data">Data da ausência</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo</Label>
                <Input
                  id="motivo"
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: Compromisso escolar, consulta médica…"
                  required
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="gap-2">
                <Send className="size-4" aria-hidden="true" />
                Enviar justificativa
              </Button>
              {enviado && (
                <span className="inline-flex items-center gap-1.5 text-sm text-[oklch(0.45_0.08_160)]">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Justificativa registrada!
                </span>
              )}
            </div>
          </form>
        </section>

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          Advertências, faltas e observações são inseridas somente pelo moderador. Você pode
          visualizá-las abaixo.
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <RegistroCard
            titulo="Justificativas"
            icon={<FileText className="size-4 text-white" aria-hidden="true" />}
            accent="bg-primary"
            itens={membro.justificativas}
            vazio="Você ainda não enviou justificativas."
          />
          <RegistroCard
            titulo="Faltas"
            icon={<CalendarX className="size-4 text-secondary-foreground" aria-hidden="true" />}
            accent="bg-secondary"
            itens={membro.faltas}
            vazio="Nenhuma falta registrada."
          />
          <RegistroCard
            titulo="Advertências"
            icon={<TriangleAlert className="size-4 text-white" aria-hidden="true" />}
            accent="bg-destructive"
            itens={membro.advertencias}
            vazio="Nenhuma advertência registrada."
          />
          <RegistroCard
            titulo="Observações"
            icon={<NotebookPen className="size-4 text-accent-foreground" aria-hidden="true" />}
            accent="bg-accent"
            itens={membro.observacoes}
            vazio="Nenhuma observação registrada."
          />
        </div>
      </main>
    </div>
  )
}
