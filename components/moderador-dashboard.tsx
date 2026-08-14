"use client"

import Link from "next/link"
import {
  ShieldCheck,
  ChevronRight,
  TriangleAlert,
  FileText,
  CalendarX,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileSettings } from "@/components/profile-settings"
import { ModeratorPromotionPanel } from "@/components/moderator-promotion-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { useStore, type Membro } from "@/lib/store"

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

function contarNoMesAtual(registros: { data: string }[]) {
  const agora = new Date()
  const prefixo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`
  return registros.filter((r) => r.data.startsWith(prefixo)).length
}

function EstatCard({
  label,
  valor,
  destaque,
  alerta,
}: {
  label: string
  valor: number
  destaque?: boolean
  alerta?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        alerta
          ? "border-destructive/30 bg-destructive/5"
          : destaque
            ? "border-accent/55 bg-accent/15"
            : "border-border bg-card"
      }`}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`font-serif text-3xl font-semibold ${
          alerta ? "text-destructive" : destaque ? "text-accent-foreground" : "text-primary"
        }`}
      >
        {valor}
      </dd>
    </div>
  )
}

export function ModeradorDashboard() {
  const { membros, equipe, aprovarMembro, recusarMembro } = useStore()
  const pendentes = membros.filter((m) => m.status === "pendente")
  const ativos = membros.filter((m) => m.status === "aprovado")
  const acolitos = equipe.filter((m) => m.funcao === "Acólito")
  const coroinhas = equipe.filter((m) => m.funcao === "Coroinha")
  const advertenciasNoMes = equipe.reduce((soma, m) => soma + contarNoMesAtual(m.advertencias), 0)

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Área Restrita"
        subtitulo="Acólitos e Coroinhas"
        voltarHref="/visitante"
        menu={<ModeradorMenu />}
        badge={
          <Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Moderador
          </Badge>
        }
      />

      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-4 sm:px-4 sm:py-8">
        <ProfileSettings />
        <ModeratorPromotionPanel />
        {/* Resumo da equipe — um retrato rápido do estado atual, não decoração */}
        <dl className="mb-6 grid grid-cols-2 gap-2.5 sm:mb-8 sm:gap-3 sm:grid-cols-4">
          <EstatCard label="Acólitos" valor={acolitos.length} />
          <EstatCard label="Coroinhas" valor={coroinhas.length} />
          <EstatCard label="Aguardando aprovação" valor={pendentes.length} destaque={pendentes.length > 0} />
          <EstatCard label="Advertências no mês" valor={advertenciasNoMes} alerta={advertenciasNoMes > 0} />
        </dl>

        {/* Cadastros pendentes de aprovação */}
        {pendentes.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-xl text-primary">
              <Clock className="size-5" aria-hidden="true" />
              Cadastros aguardando aprovação
              <Badge className="bg-accent text-accent-foreground">{pendentes.length}</Badge>
            </h2>
            <ul className="space-y-3">
              {pendentes.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/45 bg-white p-4 shadow-sm"
                >
                  <Avatar className="size-11 border border-border">
                    <AvatarImage src={m.foto || undefined} /><AvatarFallback className="bg-primary/10 font-medium text-primary">{iniciais(m.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{m.nome}</p>
                    <p className="break-words text-xs leading-5 text-muted-foreground sm:text-sm">
                      {m.funcao} · usuário: {m.usuario} · e-mail: {m.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => aprovarMembro(m.id)} className="gap-1.5">
                      <UserCheck className="size-4" aria-hidden="true" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recusarMembro(m.id)}
                      className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <UserX className="size-4" aria-hidden="true" />
                      Recusar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-xl text-primary">Perfis da equipe</h2>
          <span className="text-sm text-muted-foreground">{ativos.length} membros ativos</span>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {ativos.map((m) => (
            <li key={m.id}>
              <PerfilResumo membro={m} />
            </li>
          ))}
        </ul>

      </main>
    </div>
  )
}

function PerfilResumo({ membro: m }: { membro: Membro }) {
  return (
    <Link
      href={`/area-restrita/perfil/${m.id}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <Avatar className="size-12 border border-border">
        <AvatarImage src={m.foto || undefined} /><AvatarFallback className="bg-primary/10 font-medium text-primary">{iniciais(m.nome)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{m.nome}</p>
        <p className="text-sm text-muted-foreground">
          {m.funcao} · desde {m.desde || "data não informada"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {m.advertencias.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
              <TriangleAlert className="size-3" aria-hidden="true" />
              {m.advertencias.length} advert.
            </span>
          )}
          {m.faltas.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              <CalendarX className="size-3" aria-hidden="true" />
              {m.faltas.length} faltas
            </span>
          )}
          {m.justificativas.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              <FileText className="size-3" aria-hidden="true" />
              {m.justificativas.length} justif.
            </span>
          )}
          {m.advertencias.length === 0 && m.faltas.length === 0 && (
            <span className="rounded-full bg-[oklch(0.6_0.08_160)]/15 px-2 py-0.5 text-[oklch(0.45_0.08_160)]">
              Em dia
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  )
}
