"use client"

import Link from "next/link"
import { useState } from "react"
import { BookOpen, CheckCircle2, FileText, Lock, Send, Trophy, UsersRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileSettings } from "@/components/profile-settings"
import { MeuProximoCompromisso } from "@/components/meu-proximo-compromisso"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AreaHeader } from "@/components/area-header"
import { MembroMenu } from "@/components/area-menu"
import { Badge } from "@/components/ui/badge"
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
        voltarHref="/visitante"
        menu={<MembroMenu />}
        badge={<Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">Acesso liberado</Badge>}
      />

      <main className="mx-auto max-w-6xl px-3 py-6 pb-24 sm:px-4 sm:py-8">
        <ProfileSettings />
        <MeuProximoCompromisso />

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Link href="/formacao" className="group rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="size-5" /></span>
            <p className="mt-3 font-serif text-lg font-semibold text-primary">Formação</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Encontros, materiais e presença.</p>
          </Link>
          <Link href="/area-restrita/ranking" className="group rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Trophy className="size-5" /></span>
            <p className="mt-3 font-serif text-lg font-semibold text-primary">Jornada</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Quiz, Missão e classificação.</p>
          </Link>
          <Link href="/area-restrita/perfis" className="group rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UsersRound className="size-5" /></span>
            <p className="mt-3 font-serif text-lg font-semibold text-primary">Equipe</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Visite os perfis dos acólitos e coroinhas.</p>
          </Link>
        </div>

        <div className="mb-7 flex items-center gap-4 rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
          <Avatar className="size-16 border-2 border-primary/30"><AvatarImage src={membro.foto || undefined} /><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{iniciais(membro.nome)}</AvatarFallback></Avatar>
          <div><h2 className="font-serif text-2xl font-semibold text-foreground">{membro.nome}</h2><p className="text-sm text-muted-foreground">{membro.funcao}</p></div>
        </div>

        <section className="mb-5 overflow-hidden rounded-[26px] border border-primary/20 bg-card shadow-sm">
          <header className="border-b border-border bg-primary/[.035] px-5 py-4">
            <h3 className="flex items-center gap-2 font-serif text-xl text-primary"><FileText className="size-5" />Justificar uma ausência</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Envie a data e o motivo ao moderador. O conteúdo do registro não fica exposto no seu perfil público.</p>
          </header>
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="space-y-2"><Label htmlFor="data">Data da ausência</Label><Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="motivo">Motivo</Label><Input id="motivo" type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Compromisso escolar, consulta médica…" required /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="gap-2"><Send className="size-4" />Enviar justificativa</Button>
              {enviado && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="size-4" />Justificativa enviada ao moderador.</span>}
            </div>
          </form>
        </section>

        <div className="flex items-start gap-3 rounded-[22px] border border-primary/10 bg-primary/[.035] px-4 py-4 text-sm leading-6 text-muted-foreground">
          <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
          <div><p className="font-semibold text-foreground">Seus registros administrativos são privados.</p><p>Faltas, advertências, justificativas e observações ficam disponíveis somente aos moderadores responsáveis. Outros acólitos e coroinhas não têm acesso a essas informações.</p></div>
        </div>
      </main>
    </div>
  )
}
