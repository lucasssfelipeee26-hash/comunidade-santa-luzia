"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
  ranking?: { posicao: number; pontos: number; quizzesRespondidos: number; acertos: number; aproveitamento: number } | null
}

const STORAGE_KEY = "santa-luzia:perfis-publicos:v1"

function iniciais(nome: string) { return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() }
function primeiroNome(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return partes.length <= 1 ? nome : `${partes[0]} ${partes.at(-1)}`
}
function dataBonita(valor?: string | null) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "data não informada"
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${valor}T12:00:00`))
}
function destaqueDoRecado(texto?: string) {
  if (!texto?.trim()) return ""
  return texto.match(/\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/u)?.[0] || "•"
}

export function EquipeNoPainel() {
  const [perfis, setPerfis] = useState<PerfilEquipe[]>([])
  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState<PerfilEquipe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [offline, setOffline] = useState(false)
  const [mounted, setMounted] = useState(false)
  const railRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setMounted(true) }, [])
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
          if (ativo && Array.isArray(salvo?.perfis)) { setPerfis(salvo.perfis); setOffline(true) }
        } catch {}
      } finally { if (ativo) setCarregando(false) }
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
    const anteriorOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const fechar = (event: KeyboardEvent) => { if (event.key === "Escape") setSelecionado(null) }
    window.addEventListener("keydown", fechar)
    return () => { document.body.style.overflow = anteriorOverflow; window.removeEventListener("keydown", fechar) }
  }, [selecionado])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return perfis
    return perfis.filter((perfil) => `${perfil.nome} ${perfil.funcao} ${perfil.bio || ""}`.toLocaleLowerCase("pt-BR").includes(termo))
  }, [perfis, busca])

  function moverFaixa(direcao: -1 | 1) {
    railRef.current?.scrollBy({ left: direcao * Math.max(220, railRef.current.clientWidth * 0.75), behavior: "smooth" })
  }

  const modal = selecionado && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px]" onClick={() => setSelecionado(null)} data-profile-viewer-overlay="true" data-no-pull-refresh>
      <section role="dialog" aria-modal="true" aria-label={`Perfil de ${selecionado.nome}`} onClick={(event) => event.stopPropagation()} className="flex max-h-[calc(100dvh-32px)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[#fffdf8] shadow-2xl" data-profile-viewer-banner="true">
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-[#fffdf8] px-4 py-3">
          <div className="min-w-0 pr-2"><p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">Perfil da equipe</p><p className="truncate text-sm font-semibold text-foreground">{selecionado.nome}</p></div>
          <button type="button" aria-label="Fechar perfil" onClick={() => setSelecionado(null)} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-primary shadow-sm active:scale-95" data-profile-close="true"><X className="size-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5" data-profile-scroll="true">
          <div className="flex flex-col items-center text-center">
            <div className="relative w-[124px] overflow-visible rounded-[24px] border-[3px] border-[#d4af37] bg-[#f4eee4] p-1 shadow-lg sm:w-[138px]" data-profile-photo-frame="preserve-ratio">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-[18px] bg-[#efe6da]">
                {selecionado.foto ? <img src={selecionado.foto} alt={`Foto de ${selecionado.nome}`} className="h-full w-full object-contain object-center" data-profile-photo-full="true" /> : <div className="flex h-full w-full items-center justify-center bg-primary/10 font-serif text-3xl font-bold text-primary">{iniciais(selecionado.nome)}</div>}
              </div>
              {destaqueDoRecado(selecionado.bio) && <span className="absolute -right-2 -top-2 flex min-h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-white px-2 text-sm font-black text-primary shadow-lg">{destaqueDoRecado(selecionado.bio)}</span>}
            </div>
            <h2 className="mt-3 max-w-full break-words font-serif text-2xl font-semibold leading-tight text-primary">{selecionado.nome}</h2>
            <p className="mt-1 max-w-full break-words text-xs font-semibold text-foreground">{selecionado.funcao} · desde {dataBonita(selecionado.desde)}</p>
            <div className="mt-4 w-full rounded-2xl bg-secondary/45 p-4 text-left"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">Recado</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">{selecionado.bio || "Este membro ainda não adicionou um recado."}</p></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat icon={<Trophy className="size-5" />} value={selecionado.ranking?.posicao ? `${selecionado.ranking.posicao}º` : "—"} label="Classificação" />
            <Stat icon={<Medal className="size-5" />} value={String(selecionado.ranking?.pontos ?? 0)} label="Pontos" />
            <Stat icon={<ShieldCheck className="size-5" />} value={`${selecionado.ranking?.aproveitamento ?? 0}%`} label="Aproveitamento" />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/10 bg-primary/[.035] p-3 text-xs leading-5 text-muted-foreground"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><span>Faltas, advertências, justificativas e observações continuam privadas.</span></div>
        </div>
      </section>
    </div>, document.body) : null

  return (
    <>
      <section className="mb-3 w-full min-w-0 overflow-hidden rounded-[20px] border border-white/75 bg-white/82 px-3 py-3 shadow-[0_8px_24px_rgba(79,24,35,.06)]" data-team-profile-rail="true">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><h2 className="font-serif text-lg font-semibold text-primary">Perfis da equipe</h2><span className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-bold text-primary">{perfis.length}</span></div><p className="mt-0.5 text-[9px] leading-3.5 text-muted-foreground">Arraste para o lado como nos Status ou pesquise pelo nome.</p></div>
          <div className="relative w-[132px] shrink-0 sm:w-52"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar perfil por nome" aria-label="Buscar perfil por nome" className="h-8 rounded-xl bg-white pl-8 pr-2 text-[10px]" /></div>
        </div>
        {offline && <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[9px] text-amber-900"><WifiOff className="size-3.5 shrink-0" />Perfis salvos neste aparelho continuam disponíveis offline.</div>}
        {carregando ? <div className="mt-3 flex gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-[74px] shrink-0 text-center"><div className="mx-auto size-14 animate-pulse rounded-full bg-muted" /><div className="mx-auto mt-2 h-2.5 w-14 animate-pulse rounded bg-muted" /></div>)}</div> : filtrados.length === 0 ? <div className="mt-3 rounded-xl border border-dashed p-3 text-center text-[10px] text-muted-foreground">Nenhum perfil encontrado.</div> : <div className="relative mt-3">
          <button type="button" onClick={() => moverFaixa(-1)} aria-label="Ver perfis anteriores" className="absolute -left-1 top-5 z-10 hidden size-7 items-center justify-center rounded-full border bg-white/95 text-primary shadow sm:flex"><ChevronLeft className="size-4" /></button>
          <div ref={railRef} className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-no-pull-refresh data-team-profile-status-rail="true" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
            {filtrados.map((perfil) => <button key={perfil.id} type="button" onClick={() => setSelecionado(perfil)} className="group w-[76px] shrink-0 snap-start text-center active:scale-[.96] sm:w-[84px]" aria-label={`Abrir perfil de ${perfil.nome}`}><div className="relative mx-auto w-fit rounded-full bg-[linear-gradient(145deg,#7b1326,#d4af37,#f1d577)] p-[2px] shadow-sm"><div className="rounded-full bg-white p-[2px]"><Avatar className="size-[58px] aspect-square border border-white sm:size-16"><AvatarImage src={perfil.foto || undefined} className="h-full w-full object-cover object-center" /><AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">{iniciais(perfil.nome)}</AvatarFallback></Avatar></div>{destaqueDoRecado(perfil.bio) && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-[#fff8e9] text-[9px] font-black text-primary shadow-sm">{destaqueDoRecado(perfil.bio)}</span>}</div><span className="mt-1.5 block truncate text-[9px] font-bold leading-3 text-foreground">{primeiroNome(perfil.nome)}</span><span className="block truncate text-[8px] leading-3 text-primary">{perfil.ranking?.posicao ? `${perfil.ranking.posicao}º · ${perfil.ranking.pontos} pts` : perfil.funcao}</span></button>)}
          </div>
          <button type="button" onClick={() => moverFaixa(1)} aria-label="Ver próximos perfis" className="absolute -right-1 top-5 z-10 hidden size-7 items-center justify-center rounded-full border bg-white/95 text-primary shadow sm:flex"><ChevronRight className="size-4" /></button>
        </div>}
      </section>
      {modal}
    </>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="min-w-0 rounded-2xl border border-border bg-white px-1.5 py-3 text-center text-primary">{icon}<strong className="mt-1 block truncate text-base">{value}</strong><span className="block break-words text-[8px] leading-3 text-muted-foreground">{label}</span></div>
}
