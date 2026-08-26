"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Medal, Search, ShieldCheck, Trophy, UserRound, WifiOff, X } from "lucide-react"
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
  return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

function primeiroNome(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return nome
  return `${partes[0]} ${partes.at(-1)}`
}

function dataBonita(valor?: string | null) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "data não informada"
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${valor}T12:00:00`))
}

function destaqueDoRecado(texto?: string) {
  if (!texto?.trim()) return ""
  const emoji = texto.match(/\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/u)?.[0]
  return emoji || "•"
}

export function EquipeNoPainel() {
  const [perfis, setPerfis] = useState<PerfilEquipe[]>([])
  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState<PerfilEquipe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [offline, setOffline] = useState(false)
  const railRef = useRef<HTMLDivElement | null>(null)

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
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ atualizadoEm: Date.now(), perfis: lista })) } catch {}
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
    const atualizar = () => void carregar()
    window.addEventListener("santa-luzia:server-sync", atualizar)
    window.addEventListener("santa-luzia:offline-data", atualizar)
    return () => {
      ativo = false
      window.removeEventListener("santa-luzia:server-sync", atualizar)
      window.removeEventListener("santa-luzia:offline-data", atualizar)
    }
  }, [])

  useEffect(() => {
    if (!selecionado) return
    const fechar = (event: KeyboardEvent) => { if (event.key === "Escape") setSelecionado(null) }
    window.addEventListener("keydown", fechar)
    return () => window.removeEventListener("keydown", fechar)
  }, [selecionado])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return perfis
    return perfis.filter((perfil) => `${perfil.nome} ${perfil.funcao} ${perfil.bio || ""}`.toLocaleLowerCase("pt-BR").includes(termo))
  }, [perfis, busca])

  function moverFaixa(direcao: -1 | 1) {
    railRef.current?.scrollBy({ left: direcao * Math.max(220, railRef.current.clientWidth * 0.75), behavior: "smooth" })
  }

  return (
    <section className="mb-3 w-full min-w-0 overflow-hidden rounded-[20px] border border-white/75 bg-white/82 px-3 py-3 shadow-[0_8px_24px_rgba(79,24,35,.06)]" data-team-profile-rail="true">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h2 className="font-serif text-lg font-semibold text-primary">Perfis da equipe</h2>
            <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-bold text-primary">{perfis.length}</span>
          </div>
          <p className="mt-0.5 text-[9px] leading-3.5 text-muted-foreground">Arraste para o lado como nos Status ou pesquise pelo nome.</p>
        </div>
        <div className="relative w-[118px] shrink-0 sm:w-52">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar" className="h-8 rounded-xl bg-white pl-8 pr-2 text-[10px]" />
        </div>
      </div>

      {offline && <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[9px] text-amber-900"><WifiOff className="size-3.5 shrink-0" />Perfis salvos neste aparelho continuam disponíveis offline.</div>}

      {carregando ? (
        <div className="mt-3 flex gap-3 overflow-hidden" aria-label="Carregando perfis">
          {Array.from({ length: 4 }).map((_, indice) => <div key={indice} className="w-[74px] shrink-0 text-center"><div className="mx-auto size-14 animate-pulse rounded-full bg-muted" /><div className="mx-auto mt-2 h-2.5 w-14 animate-pulse rounded bg-muted" /></div>)}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">Nenhum perfil encontrado.</div>
      ) : (
        <div className="relative mt-3">
          <button type="button" onClick={() => moverFaixa(-1)} aria-label="Ver perfis anteriores" className="absolute -left-1 top-5 z-10 hidden size-7 items-center justify-center rounded-full border bg-white/95 text-primary shadow sm:flex"><ChevronLeft className="size-4" /></button>
          <div
            ref={railRef}
            className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-no-pull-refresh
            data-team-profile-status-rail="true"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
          >
            {filtrados.map((perfil) => {
              const destaque = destaqueDoRecado(perfil.bio)
              return (
                <button key={perfil.id} type="button" onClick={() => setSelecionado(perfil)} className="group w-[76px] shrink-0 snap-start text-center active:scale-[.96] sm:w-[84px]" aria-label={`Abrir perfil de ${perfil.nome}`}>
                  <div className="relative mx-auto w-fit rounded-full bg-[linear-gradient(145deg,#7b1326,#d4af37,#f1d577)] p-[2px] shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <div className="rounded-full bg-white p-[2px]">
                      <Avatar className="size-[58px] border border-white sm:size-16">
                        <AvatarImage src={perfil.foto || undefined} className="object-cover object-center" />
                        <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">{iniciais(perfil.nome)}</AvatarFallback>
                      </Avatar>
                    </div>
                    {destaque && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-[#fff8e9] text-[9px] font-black text-primary shadow-sm">{destaque}</span>}
                  </div>
                  <span className="mt-1.5 block truncate text-[9px] font-bold leading-3 text-foreground">{primeiroNome(perfil.nome)}</span>
                  <span className="block truncate text-[8px] leading-3 text-primary">{perfil.ranking?.posicao ? `${perfil.ranking.posicao}º · ${perfil.ranking.pontos} pts` : perfil.funcao}</span>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => moverFaixa(1)} aria-label="Ver próximos perfis" className="absolute -right-1 top-5 z-10 hidden size-7 items-center justify-center rounded-full border bg-white/95 text-primary shadow sm:flex"><ChevronRight className="size-4" /></button>
        </div>
      )}

      {selecionado && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/38 px-2 pb-3 pt-[calc(env(safe-area-inset-top)+70px)] sm:px-5 sm:pt-24" onClick={() => setSelecionado(null)} data-profile-viewer-overlay="true">
          <section role="dialog" aria-modal="true" aria-label={`Perfil de ${selecionado.nome}`} onClick={(event) => event.stopPropagation()} className="max-h-[calc(100dvh-90px-env(safe-area-inset-top))] w-full min-w-0 max-w-lg overflow-x-hidden overflow-y-auto rounded-[26px] border border-white/70 bg-[#fffdf8] shadow-2xl" data-profile-viewer-banner="true">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-[#fffdf8]/95 px-4 py-3 backdrop-blur-sm">
              <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">Perfil da equipe</p><p className="truncate text-xs font-semibold text-foreground">{selecionado.nome}</p></div>
              <button type="button" aria-label="Fechar perfil" onClick={() => setSelecionado(null)} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-primary shadow-sm" data-profile-close="true"><X className="size-4" /></button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex min-w-0 flex-col items-center text-center">
                <div className="relative rounded-full bg-[linear-gradient(145deg,#7b1326,#d4af37,#f1d577)] p-[3px] shadow-lg">
                  <div className="rounded-full bg-white p-[3px]"><Avatar className="size-24 border border-white sm:size-28"><AvatarImage src={selecionado.foto || undefined} className="object-cover object-center" /><AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{iniciais(selecionado.nome)}</AvatarFallback></Avatar></div>
                  {destaqueDoRecado(selecionado.bio) && <span className="absolute -right-2 -top-1 flex min-h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-white px-2 text-sm font-black text-primary shadow-lg">{destaqueDoRecado(selecionado.bio)}</span>}
                </div>
                <h2 className="mt-3 max-w-full break-words font-serif text-2xl font-semibold text-primary sm:text-3xl">{selecionado.nome}</h2>
                <p className="mt-1 max-w-full break-words text-sm font-semibold text-foreground">{selecionado.funcao} · desde {dataBonita(selecionado.desde)}</p>
                <div className="mt-4 w-full min-w-0 rounded-2xl bg-secondary/45 p-4 text-left"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Recado</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{selecionado.bio || "Este membro ainda não adicionou um recado."}</p></div>
              </div>

              <div className="mt-5 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center sm:p-3"><Trophy className="mx-auto size-5 text-primary" /><strong className="mt-1 block truncate text-base text-primary sm:text-lg">{selecionado.ranking?.posicao ? `${selecionado.ranking.posicao}º` : "—"}</strong><span className="block break-words text-[9px] leading-3 text-muted-foreground sm:text-[10px]">Classificação</span></div>
                <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center sm:p-3"><Medal className="mx-auto size-5 text-primary" /><strong className="mt-1 block truncate text-base text-primary sm:text-lg">{selecionado.ranking?.pontos ?? 0}</strong><span className="block text-[9px] leading-3 text-muted-foreground sm:text-[10px]">Pontos</span></div>
                <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center sm:p-3"><ShieldCheck className="mx-auto size-5 text-primary" /><strong className="mt-1 block truncate text-base text-primary sm:text-lg">{selecionado.ranking?.aproveitamento ?? 0}%</strong><span className="block break-words text-[9px] leading-3 text-muted-foreground sm:text-[10px]">Aproveitamento</span></div>
              </div>
              <div className="mt-4 flex min-w-0 items-start gap-2 rounded-2xl border border-primary/10 bg-primary/[.035] p-3 text-xs leading-5 text-muted-foreground"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><span className="min-w-0 break-words">Faltas, advertências, justificativas e observações continuam privadas.</span></div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
