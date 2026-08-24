"use client"

import Link from "next/link"
import { useState } from "react"
import { BookOpen, CheckCircle2, Clock, FileText, Lock, Send, Trophy } from "lucide-react"
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
import { MeuRelatorioWindows } from "@/components/meu-relatorio-windows"

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
}

function Atalho({ href, icone, titulo, texto }: { href: string; icone: React.ReactNode; titulo: string; texto: string }) {
  return <Link href={href} className="group min-w-0 rounded-2xl border border-border bg-white/80 p-2.5 shadow-sm transition hover:border-primary/25"><span className="flex size-8 items-center justify-center rounded-xl bg-primary/8 text-primary">{icone}</span><p className="mt-2 truncate font-serif text-sm font-semibold text-primary">{titulo}</p><p className="truncate text-[9px] text-muted-foreground">{texto}</p></Link>
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
      <AreaHeader titulo="Meu Perfil" subtitulo={`${membro.funcao} · na equipe desde ${membro.desde || "data não informada"}`} voltarHref="/visitante" menu={<MembroMenu />} badge={<Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">Acesso liberado</Badge>} />

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-4 pb-24 sm:px-4 sm:py-6">
        <ProfileSettings />
        <MeuProximoCompromisso />

        <div className="mb-3 grid min-w-0 grid-cols-3 gap-2">
          <Atalho href="/formacao" icone={<BookOpen className="size-4" />} titulo="Formação" texto="Presença e materiais" />
          <Atalho href="/area-restrita/ranking" icone={<Trophy className="size-4" />} titulo="Jornada" texto="Quiz, jogo e ranking" />
          <Atalho href="/area-restrita/atrasos" icone={<Clock className="size-4" />} titulo="Atrasos" texto="Relatar e acompanhar" />
        </div>

        <EquipeNoPainel />
        <MeuRelatorioWindows />

        <section className="mb-3 min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="border-b border-border bg-primary/[.025] px-3 py-2.5">
            <h3 className="flex min-w-0 items-center gap-2 font-serif text-base font-semibold text-primary"><FileText className="size-4 shrink-0" />Justificar uma ausência</h3>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">O motivo é enviado ao moderador e não aparece no perfil público.</p>
          </header>
          <form onSubmit={handleSubmit} className="min-w-0 p-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0 space-y-1"><Label htmlFor="data" className="text-[10px]">Data</Label><Input id="data" type="date" value={data} onChange={(event) => setData(event.target.value)} required className="h-10" /></div>
              <div className="min-w-0 space-y-1"><Label htmlFor="motivo" className="text-[10px]">Motivo</Label><Input id="motivo" type="text" value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ex.: Compromisso escolar, consulta…" required className="h-10" /></div>
              <Button type="submit" size="sm" className="h-10 gap-1.5 rounded-xl px-3 text-xs"><Send className="size-3.5" />Enviar</Button>
            </div>
            {enviado && <span className="mt-2 inline-flex min-w-0 items-center gap-1.5 text-[10px] text-emerald-700"><CheckCircle2 className="size-3.5 shrink-0" />Justificativa enviada ao moderador.</span>}
          </form>
        </section>

        <div className="flex min-w-0 items-start gap-2 rounded-xl border border-primary/10 bg-primary/[.025] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0 text-primary" /><p className="min-w-0"><strong className="text-foreground">Seu histórico não é público.</strong> Presenças, faltas, justificativas, advertências e atrasos aparecem no seu relatório pessoal e para os moderadores. Observações administrativas internas continuam visíveis somente à moderação.</p></div>
      </main>
    </div>
  )
}
