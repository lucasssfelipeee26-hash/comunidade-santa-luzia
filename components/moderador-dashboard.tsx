"use client"

import Link from "next/link"
import { ShieldCheck, ChevronRight, UserCheck, UserX, Clock, ClipboardCheck } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileSettings } from "@/components/profile-settings"
import { ModeratorPromotionPanel } from "@/components/moderator-promotion-panel"
import { EquipeNoPainel } from "@/components/equipe-no-painel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { useStore } from "@/lib/store"

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

function contarNoMesAtual(registros: { data: string }[]) {
  const agora = new Date()
  const prefixo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`
  return registros.filter((r) => r.data.startsWith(prefixo)).length
}

function EstatCard({ label, valor, destaque, alerta }: { label: string; valor: number; destaque?: boolean; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${alerta ? "border-destructive/20 bg-destructive/[.025]" : destaque ? "border-accent/35 bg-accent/[.06]" : "border-border bg-card"}`}>
      <dt className="truncate text-[9px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-serif text-2xl font-semibold ${alerta ? "text-destructive" : "text-primary"}`}>{valor}</dd>
    </div>
  )
}

export function ModeradorDashboard() {
  const { membros, equipe, dadosModeradorCarregando, aprovarMembro, recusarMembro } = useStore()
  const pendentes = membros.filter((m) => m.status === "pendente")
  const acolitos = equipe.filter((m) => m.funcao === "Acólito")
  const coroinhas = equipe.filter((m) => m.funcao === "Coroinha")
  const advertenciasNoMes = equipe.reduce((soma, m) => soma + contarNoMesAtual(m.advertencias), 0)

  return (
    <div className="moderador-painel min-h-screen bg-background">
      <AreaHeader titulo="Área Restrita" subtitulo="Acólitos e Coroinhas" voltarHref="/visitante" menu={<ModeradorMenu />} badge={<Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck className="size-4" aria-hidden="true" />Moderador</Badge>} />

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-4 pb-24 sm:px-4 sm:py-6">
        <ProfileSettings />
        <ModeratorPromotionPanel />

        {dadosModeradorCarregando ? <div className="mb-3 grid grid-cols-4 gap-1.5 sm:gap-2" aria-label="Carregando indicadores da equipe">{Array.from({ length: 4 }).map((_, indice) => <div key={indice} className="h-[58px] animate-pulse rounded-xl border bg-white/70" />)}</div> : <dl className="mb-3 grid grid-cols-4 gap-1.5 sm:gap-2">
          <EstatCard label="Acólitos" valor={acolitos.length} />
          <EstatCard label="Coroinhas" valor={coroinhas.length} />
          <EstatCard label="Aguardando" valor={pendentes.length} destaque={pendentes.length > 0} />
          <EstatCard label="Advertências" valor={advertenciasNoMes} alerta={advertenciasNoMes > 0} />
        </dl>}

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Link href="/area-restrita/atrasos" data-sl-nav-motion="clock" className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-white/80 p-2.5 shadow-sm transition hover:border-primary/30">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Clock className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-foreground">Atrasos</strong><span className="block truncate text-[9px] text-muted-foreground">Relatos e confirmações</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
          <Link href="/area-restrita/moderador/presencas" data-sl-nav-motion="presence" className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-white/80 p-2.5 shadow-sm transition hover:border-primary/30">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><ClipboardCheck className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-foreground">Presenças</strong><span className="block truncate text-[9px] text-muted-foreground">Formações da equipe</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>

        {pendentes.length > 0 && (
          <details className="group mb-3 overflow-hidden rounded-2xl border border-border bg-white/80 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:hidden">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-serif text-base font-semibold text-primary">Cadastros aguardando aprovação</span>
              <Badge className="h-5 bg-accent/20 px-1.5 text-[9px] text-accent-foreground">{pendentes.length}</Badge>
              <ChevronRight className="size-4 text-muted-foreground transition group-open:rotate-90" />
            </summary>
            <ul className="space-y-1.5 border-t border-border/70 p-2.5">
              {pendentes.map((m) => (
                <li key={m.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-white p-2">
                  <Avatar className="size-9 shrink-0 border border-border"><AvatarImage src={m.foto || undefined} /><AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">{iniciais(m.nome)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-foreground">{m.nome}</p><p className="truncate text-[9px] text-muted-foreground">{m.funcao} · @{m.usuario}</p></div>
                  <div className="flex shrink-0 gap-1"><Button size="sm" onClick={() => aprovarMembro(m.id)} className="h-8 gap-1 rounded-lg px-2 text-[9px]"><UserCheck className="size-3" />Aprovar</Button><Button size="sm" variant="outline" onClick={() => recusarMembro(m.id)} className="h-8 gap-1 rounded-lg border-destructive/25 px-2 text-[9px] text-destructive"><UserX className="size-3" />Recusar</Button></div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <EquipeNoPainel />
      </main>
    </div>
  )
}