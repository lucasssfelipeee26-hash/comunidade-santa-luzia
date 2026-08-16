"use client"

import Link from "next/link"
import { useState } from "react"
import { BookOpen, CheckCircle2, FileText, Lock, Send, Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileSettings } from "@/components/profile-settings"
import { MeuProximoCompromisso } from "@/components/meu-proximo-compromisso"
import { EquipeNoPainel } from "@/components/equipe-no-painel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AreaHeader } from "@/components/area-header"
import { MembroMenu } from "@/components/area-menu"
import { Badge } from "@/components/ui/badge"
import { useStore, type Membro } from "@/lib/store"

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase()
}

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
}

export function MembroDashboard({ membro }: { membro: Membro }) {
  const { adicionarJustificativa } = useStore()
  const [data, setData] = useState(hojeISO())
  const [motivo, setMotivo] = useState("")
  const [enviado, setEnviado] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
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
        voltarHref="/visitante"
        menu={<MembroMenu />}
        badge={<Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">Acesso liberado</Badge>}
      />

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-6 pb-24 sm:px-4 sm:py-8">
        <ProfileSettings />
        <MeuProximoCompromisso />

        <div className="mb-6 grid min-w-0 gap-3 sm:grid-cols-2">
          <Link
            href="/formacao"
            className="group min-w-0 rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <p className="mt-3 break-words font-serif text-lg font-semibold text-primary">Formação</p>
            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">Encontros, materiais e presença.</p>
          </Link>
          <Link
            href="/area-restrita/ranking"
            className="group min-w-0 rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Trophy className="size-5" />
            </span>
            <p className="mt-3 break-words font-serif text-lg font-semibold text-primary">Jornada</p>
            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">Quiz, Missão e classificação.</p>
          </Link>
        </div>

        <EquipeNoPainel />

        <div className="mb-7 flex min-w-0 items-center gap-4 rounded-[24px] border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <Avatar className="size-14 shrink-0 border-2 border-primary/30 sm:size-16">
            <AvatarImage src={membro.foto || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{iniciais(membro.nome)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="break-words font-serif text-xl font-semibold text-foreground sm:text-2xl">{membro.nome}</h2>
            <p className="text-sm text-muted-foreground">{membro.funcao}</p>
          </div>
        </div>

        <section className="mb-5 min-w-0 overflow-hidden rounded-[26px] border border-primary/20 bg-card shadow-sm">
          <header className="border-b border-border bg-primary/[.035] px-4 py-4 sm:px-5">
            <h3 className="flex min-w-0 items-center gap-2 font-serif text-xl text-primary">
              <FileText className="size-5 shrink-0" />
              <span className="min-w-0 break-words">Justificar uma ausência</span>
            </h3>
            <p className="mt-1 break-words text-sm leading-5 text-muted-foreground">
              Envie a data e o motivo ao moderador. O conteúdo do registro não fica exposto no seu perfil público.
            </p>
          </header>
          <form onSubmit={handleSubmit} className="min-w-0 space-y-4 px-4 py-5 sm:px-5">
            <div className="grid min-w-0 gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="data">Data da ausência</Label>
                <Input id="data" type="date" value={data} onChange={(event) => setData(event.target.value)} required />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="motivo">Motivo</Label>
                <Input
                  id="motivo"
                  type="text"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Ex.: Compromisso escolar, consulta médica…"
                  required
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Button type="submit" className="gap-2">
                <Send className="size-4" />
                Enviar justificativa
              </Button>
              {enviado && (
                <span className="inline-flex min-w-0 items-center gap-1.5 break-words text-sm text-emerald-700">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Justificativa enviada ao moderador.
                </span>
              )}
            </div>
          </form>
        </section>

        <div className="flex min-w-0 items-start gap-3 rounded-[22px] border border-primary/10 bg-primary/[.035] px-4 py-4 text-sm leading-6 text-muted-foreground">
          <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Seus registros administrativos são privados.</p>
            <p className="break-words">
              Faltas, advertências, justificativas e observações ficam disponíveis somente aos moderadores responsáveis. Outros acólitos e coroinhas não têm acesso a essas informações.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
