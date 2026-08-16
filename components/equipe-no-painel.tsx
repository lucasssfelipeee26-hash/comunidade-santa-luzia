"use client"

import { useEffect, useMemo, useState } from "react"
import { Medal, Search, ShieldCheck, Trophy, UserRound, WifiOff, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

type PerfilEquipe = {
  id: string
  nome: string
  funcao: "Acólito" | "Coroinha"
  desde?: string | null
  foto?: string | null
  bio?: string
  ranking?: {
    posicao: number
    pontos: number
    quizzesRespondidos: number
    acertos: number
    aproveitamento: number
  } | null
}

const STORAGE_KEY = "santa-luzia:perfis-publicos:v1"

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase()
}

function dataBonita(valor?: string | null) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "data não informada"
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${valor}T12:00:00`),
  )
}

export function EquipeNoPainel() {
  const [perfis, setPerfis] = useState<PerfilEquipe[]>([])
  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState<PerfilEquipe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const resposta = await fetch("/api/perfis", { cache: "no-store" })
        if (!resposta.ok) throw new Error("Falha ao carregar perfis")
        const json = await resposta.json()
        const lista = Array.isArray(json?.perfis) ? json.perfis : []
        if (!ativo) return
        setPerfis(lista)
        setOffline(false)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ atualizadoEm: Date.now(), perfis: lista }))
        } catch {}
      } catch {
        try {
          const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
          if (ativo && Array.isArray(salvo?.perfis)) {
            setPerfis(salvo.perfis)
            setOffline(true)
          }
        } catch {}
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return perfis
    return perfis.filter((perfil) =>
      `${perfil.nome} ${perfil.funcao} ${perfil.bio || ""}`.toLocaleLowerCase("pt-BR").includes(termo),
    )
  }, [perfis, busca])

  return (
    <section className="mb-7 w-full min-w-0 overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_18px_45px_rgba(79,24,35,.08)] sm:p-5">
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Comunidade Santa Luzia</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl font-semibold text-primary">Equipe</h2>
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-bold text-primary">
              {perfis.length} {perfis.length === 1 ? "perfil" : "perfis"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
            Toque em um acólito ou coroinha para ver recado, classificação, pontos e aproveitamento.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar na equipe"
            className="h-11 rounded-2xl bg-white pl-9"
          />
        </div>
      </div>

      {offline && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
          <WifiOff className="mt-0.5 size-4 shrink-0" />
          Sem internet: mostrando os últimos perfis sincronizados neste aparelho.
        </div>
      )}

      {carregando ? (
        <div className="rounded-2xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">Carregando equipe…</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum perfil encontrado.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((perfil) => (
            <button
              key={perfil.id}
              type="button"
              onClick={() => setSelecionado(perfil)}
              className="group w-full min-w-0 overflow-hidden rounded-[24px] border border-border/70 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md active:scale-[.99]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-13 shrink-0 border-2 border-accent/45 shadow-sm">
                  <AvatarImage src={perfil.foto || undefined} />
                  <AvatarFallback className="bg-primary/10 font-bold text-primary">{iniciais(perfil.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-serif text-lg font-semibold text-foreground">{perfil.nome}</h3>
                  <p className="text-xs font-semibold text-primary">{perfil.funcao}</p>
                  <p className="truncate text-[11px] text-muted-foreground">Desde {dataBonita(perfil.desde)}</p>
                </div>
                {perfil.ranking?.posicao ? (
                  <span className="shrink-0 rounded-xl bg-primary/8 px-2 py-1 text-xs font-bold text-primary">
                    {perfil.ranking.posicao}º
                  </span>
                ) : null}
              </div>
              <div className="mt-3 rounded-2xl bg-secondary/45 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">Recado</p>
                <p className="mt-1 line-clamp-2 min-h-10 break-words text-sm leading-5 text-muted-foreground">
                  {perfil.bio || "Este membro ainda não adicionou um recado."}
                </p>
              </div>
              <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                <span className="truncate text-muted-foreground">Ver perfil</span>
                <span className="shrink-0 font-bold text-primary">{perfil.ranking?.pontos ?? 0} pts</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selecionado && (
        <div
          className="fixed inset-0 z-[120] grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-5"
          onClick={() => setSelecionado(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${selecionado.nome}`}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[92dvh] w-full min-w-0 max-w-lg overflow-x-hidden overflow-y-auto rounded-t-[30px] border border-white/70 bg-[#fffdf8] p-4 shadow-2xl sm:rounded-[30px] sm:p-6"
          >
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Fechar perfil"
                onClick={() => setSelecionado(null)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex min-w-0 flex-col items-center text-center">
              <Avatar className="size-22 border-4 border-accent/45 shadow-lg sm:size-24">
                <AvatarImage src={selecionado.foto || undefined} />
                <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{iniciais(selecionado.nome)}</AvatarFallback>
              </Avatar>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[.18em] text-primary">Perfil da equipe</p>
              <h2 className="mt-1 max-w-full break-words font-serif text-2xl font-semibold text-primary sm:text-3xl">
                {selecionado.nome}
              </h2>
              <p className="mt-1 max-w-full break-words text-sm font-semibold text-foreground">
                {selecionado.funcao} · desde {dataBonita(selecionado.desde)}
              </p>
              <div className="mt-4 w-full min-w-0 rounded-2xl bg-secondary/45 p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Recado</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                  {selecionado.bio || "Este membro ainda não adicionou um recado."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
              <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center sm:p-3">
                <Trophy className="mx-auto size-5 text-primary" />
                <strong className="mt-1 block truncate text-base text-primary sm:text-lg">
                  {selecionado.ranking?.posicao ? `${selecionado.ranking.posicao}º` : "—"}
                </strong>
                <span className="block break-words text-[9px] leading-3 text-muted-foreground sm:text-[10px]">Classificação</span>
              </div>
              <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center sm:p-3">
                <Medal className="mx-auto size-5 text-primary" />
                <strong className="mt-1 block truncate text-base text-primary sm:text-lg">{selecionado.ranking?.pontos ?? 0}</strong>
                <span className="block text-[9px] leading-3 text-muted-foreground sm:text-[10px]">Pontos</span>
              </div>
              <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center sm:p-3">
                <ShieldCheck className="mx-auto size-5 text-primary" />
                <strong className="mt-1 block truncate text-base text-primary sm:text-lg">
                  {selecionado.ranking?.aproveitamento ?? 0}%
                </strong>
                <span className="block break-words text-[9px] leading-3 text-muted-foreground sm:text-[10px]">Aproveitamento</span>
              </div>
            </div>

            <div className="mt-4 flex min-w-0 items-start gap-2 rounded-2xl border border-primary/10 bg-primary/[.035] p-3 text-xs leading-5 text-muted-foreground">
              <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">Faltas, advertências, justificativas e observações continuam privadas.</span>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
