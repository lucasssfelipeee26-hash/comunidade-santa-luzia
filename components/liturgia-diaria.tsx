"use client"

import Link from "next/link"
import { useState } from "react"
import useSWR from "swr"
import { AlertCircle, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import type { Liturgia } from "@/app/api/liturgia/route"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { LeitorPaginado } from "@/components/leitor-paginado"
import { normalizarReferenciaBiblica, separarNumeroVersiculo } from "@/lib/referencia-biblica"

type LiturgiaApp = Liturgia & { dataIso?: string; origem?: "offline"; offline?: boolean; quizDisponivel?: boolean }

const fetcher = async (url: string) => {
  const resposta = await fetch(url, { cache: "no-store" })
  const json = await resposta.json().catch(() => null)
  if (!resposta.ok || !json) throw new Error(json?.erro || "Liturgia indisponível.")
  return json
}

const corMap: Record<string, string> = {
  Verde: "bg-[oklch(0.6_0.08_160)] text-white",
  Branco: "bg-secondary text-secondary-foreground border border-border",
  Vermelho: "bg-destructive text-white",
  Roxo: "bg-[oklch(0.5_0.09_300)] text-white",
  Rosa: "bg-[oklch(0.75_0.09_10)] text-white",
}

type ItensLeitura = Liturgia["leituras"]["primeiraLeitura"]

function ReferenciaBiblica({ valor }: { valor?: string }) {
  const referencia = normalizarReferenciaBiblica(valor)
  if (!referencia) return null
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-[#d4af37]/45 bg-[#fff7df] px-3 py-1 text-xs font-bold tracking-[.01em] text-[#7b1326] shadow-sm">
      {referencia}
    </span>
  )
}

function TextoComVersiculos({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r/g, "").split("\n")
  return (
    <div className="space-y-2.5 text-pretty">
      {linhas.map((linha, indice) => {
        const limpa = linha.trim()
        if (!limpa) return <div key={`espaco-${indice}`} className="h-1" aria-hidden="true" />
        const versiculo = separarNumeroVersiculo(limpa)
        if (!versiculo) return <p key={indice} className="leading-7 sm:leading-8">{limpa}</p>
        return (
          <p key={indice} className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 leading-7 sm:leading-8">
            <sup className="mt-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#8f182e]/8 px-1 text-[11px] font-extrabold leading-none text-[#8f182e]">
              {versiculo.numero}
            </sup>
            <span className="min-w-0">{versiculo.texto}</span>
          </p>
        )
      })}
    </div>
  )
}

function ConteudoLeitura({ itens }: { itens: NonNullable<ItensLeitura> }) {
  return (
    <div className="text-[0.98rem] text-foreground/90 sm:text-base">
      {itens.map((item, i) => (
        <section key={i} className="mb-5 last:mb-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {item.titulo && <p className="mr-auto font-medium leading-6 text-foreground">{item.titulo}</p>}
            <ReferenciaBiblica valor={item.referencia} />
          </div>
          {item.refrao && <p className="mb-3 rounded-xl border border-[#8f182e]/15 bg-[#8f182e]/5 px-3 py-2 font-semibold italic leading-6 text-[#8f182e]">R. {item.refrao}</p>}
          {item.texto && <TextoComVersiculos texto={item.texto} />}
        </section>
      ))}
    </div>
  )
}

export function LiturgiaDiaria() {
  const { data, error, isLoading } = useSWR<LiturgiaApp>("/api/liturgia-local", fetcher, { revalidateOnFocus: false, refreshInterval: 0 })
  const [leituraAtivaId, setLeituraAtivaId] = useState<string | null>(null)

  if (isLoading) return <div className="flex items-center justify-center gap-3 rounded-2xl border bg-white/80 p-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Abrindo Liturgia do dia…</div>
  if (error || !data) return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
    <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0" /><div><strong>Liturgia indisponível para hoje.</strong><p className="mt-1 text-sm">O conteúdo litúrgico desta data ainda não está disponível.</p></div></div>
  </div>

  function marcarLeituraConcluida() {
    if (!data?.dataIso) return
    try { localStorage.setItem(`santa-luzia:liturgia-lida:${data.dataIso}`, "1"); window.dispatchEvent(new CustomEvent("santa-luzia:liturgia-lida", { detail: { dataIso: data.dataIso } })) } catch {}
  }

  const blocos = [
    { id: "primeira", titulo: "1ª Leitura", itens: data.leituras.primeiraLeitura },
    { id: "salmo", titulo: "Salmo Responsorial", itens: data.leituras.salmo },
    { id: "segunda", titulo: "2ª Leitura", itens: data.leituras.segundaLeitura },
    { id: "evangelho", titulo: "Evangelho", itens: data.leituras.evangelho },
    { id: "extras", titulo: "Leituras adicionais", itens: data.leituras.extras },
  ].filter((bloco) => bloco.itens?.length)
  const leituraAtiva = blocos.find((bloco) => bloco.id === leituraAtivaId)

  return <div className="overflow-hidden rounded-3xl border border-border/80 bg-white/90 shadow-sm">
    <div className="bg-primary px-4 py-5 text-primary-foreground sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><BookOpen className="size-7 text-accent" /><div><p className="text-sm text-primary-foreground/70">{data.data}</p><h3 className="font-serif text-2xl font-semibold sm:text-3xl">{data.liturgia}</h3><p className="mt-1 text-xs text-primary-foreground/70">{data.tempoLiturgicoAtual}</p></div></div>
        <Badge className={corMap[data.cor] || "bg-secondary text-secondary-foreground"}>Cor: {data.cor}</Badge>
      </div>
    </div>

    <div className="p-3 sm:p-5">
      {leituraAtiva ? <section id="leitor-liturgia" className="rounded-2xl border border-[#d4af37]/35 bg-[#fffdf8] p-3 sm:p-5" aria-live="polite">
        <button type="button" onClick={() => setLeituraAtivaId(null)} className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/45 bg-white px-3 py-2 text-sm font-semibold text-[#7b1326]">
          <ChevronLeft className="size-4" />Todas as leituras
        </button>
        <div className="mt-3 border-b border-[#d4af37]/30 pb-3">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#9a731d]">Liturgia da Palavra</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-serif text-2xl font-semibold text-[#7b1326]">{leituraAtiva.titulo}</h4>
            <ReferenciaBiblica valor={leituraAtiva.itens?.[0]?.referencia} />
          </div>
        </div>
        <LeitorPaginado key={leituraAtiva.id}>
          <ConteudoLeitura itens={leituraAtiva.itens!} />
        </LeitorPaginado>
      </section> : <section className="rounded-2xl border border-[#d4af37]/35 bg-[#fffaf8] p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 px-1 text-[#6b5137]"><BookOpen className="size-5 text-[#8f182e]" /><p className="text-sm font-semibold">Selecione uma leitura</p></div>
        <div className="grid gap-2">
          {blocos.map((bloco) => <button key={bloco.id} type="button" onClick={() => setLeituraAtivaId(bloco.id)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-[#d9cfb9] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#d4af37] active:scale-[.99]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f5e8c3] text-[#8f182e]"><BookOpen className="size-4" /></span>
            <span className="min-w-0 flex-1"><strong className="block font-serif text-lg text-[#583b28]">{bloco.titulo}</strong>{bloco.itens?.[0]?.referencia && <span className="mt-1 block whitespace-normal text-xs font-semibold leading-4 text-[#7b1326]">{normalizarReferenciaBiblica(bloco.itens[0].referencia)}</span>}</span>
            <ChevronRight className="size-5 shrink-0 text-[#8f182e]" />
          </button>)}
        </div>
      </section>}

      <div className="mt-3 rounded-2xl border bg-white/70 p-4">
        <div className="flex items-center gap-2"><CalendarDays className="size-4 text-[#8f182e]" /><strong className="text-sm">Informações do dia</strong></div>
        <p className="mt-2 text-sm leading-6">Ano litúrgico <strong>{data.anoLiturgico || "—"}</strong> · Ciclo dominical <strong>{data.cicloDominical || "—"}</strong> · Ciclo ferial <strong>{data.cicloFerial || "—"}</strong>.</p>
      </div>

      {data.quizDisponivel && <div className="mt-6 rounded-2xl border border-accent/45 bg-[#fffaf0] p-4">
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><div><h4 className="font-serif text-lg font-semibold text-primary">Quiz alinhado com esta Liturgia</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">O Quiz de hoje usa exatamente as mesmas referências bíblicas normalizadas exibidas acima.</p></div></div>
        <Link href="/area-restrita/ranking" onClick={marcarLeituraConcluida} className={`${buttonVariants({ size: "lg" })} mt-3 w-full sm:w-auto`}>Concluir leitura e abrir Quiz</Link>
      </div>}
    </div>
  </div>
}
