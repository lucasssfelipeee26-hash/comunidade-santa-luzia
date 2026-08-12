"use client"

import useSWR from "swr"
import { BookOpen, Loader2, AlertCircle, CalendarDays, Sparkles, ExternalLink } from "lucide-react"
import type { Liturgia } from "@/app/api/liturgia/route"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
function toRoman(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 40) return String(value)
  const pares: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
  let n = value
  let out = ""
  for (const [decimal, roman] of pares) {
    while (n >= decimal) {
      out += roman
      n -= decimal
    }
  }
  return out
}

function romanizarLiturgia(texto?: string) {
  if (!texto) return ""
  return texto.replace(/\b(\d{1,2})\s*(?:º|ª|°|o|a)(?=\s|$)/gi, (_, n) => toRoman(Number(n)))
}


const corMap: Record<string, { label: string; className: string }> = {
  Verde: { label: "Verde", className: "bg-[oklch(0.6_0.08_160)] text-white" },
  Branco: { label: "Branco", className: "bg-secondary text-secondary-foreground border border-border" },
  Vermelho: { label: "Vermelho", className: "bg-destructive text-white" },
  Roxo: { label: "Roxo", className: "bg-[oklch(0.5_0.09_300)] text-white" },
  Rosa: { label: "Rosa", className: "bg-[oklch(0.75_0.09_10)] text-white" },
}

function Bloco({ titulo, itens }: { titulo: string; itens?: Liturgia["leituras"]["primeiraLeitura"] }) {
  if (!itens || itens.length === 0) return null
  return (
    <AccordionItem value={titulo}>
      <AccordionTrigger className="text-left font-serif text-xl text-primary hover:no-underline">
        <span className="flex flex-col">
          {titulo}
          {itens[0]?.referencia && (
            <span className="text-sm font-normal text-muted-foreground">{itens[0].referencia}</span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {itens.map((item, i) => (
          <div key={i} className="mb-4 last:mb-0">
            {item.titulo && <p className="mb-2 font-medium text-foreground">{item.titulo}</p>}
            {item.refrao && <p className="mb-2 italic text-primary">R. {item.refrao}</p>}
            {item.texto && (
              <p className="whitespace-pre-line text-pretty leading-relaxed text-foreground/85">
                {item.texto}
              </p>
            )}
          </div>
        ))}
      </AccordionContent>
    </AccordionItem>
  )
}

export function LiturgiaDiaria() {
  const { data, error, isLoading } = useSWR<Liturgia & { error?: string }>(
    "/api/liturgia",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60 * 60 * 1000 },
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card p-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Atualizando a Liturgia Diária pela Canção Nova…
      </div>
    )
  }

  if (error || !data || data.error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        <AlertCircle className="size-5 shrink-0" />
        Não foi possível atualizar a Liturgia Diária pela Canção Nova. Tente novamente mais tarde.
      </div>
    )
  }

  const cor = corMap[data.cor] ?? { label: data.cor, className: "bg-secondary text-secondary-foreground" }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/15 px-4 py-2.5 sm:px-6 text-sm text-primary">
        <CalendarDays className="size-4 shrink-0 text-accent-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Tempo litúrgico atual:</span>
        <span className="font-semibold text-foreground">{romanizarLiturgia(data.tempoLiturgicoAtual)}</span>
        <span className="ml-auto text-xs text-muted-foreground">Atualização automática · Canção Nova</span>
      </div>

      <div className="border-b border-border bg-primary px-4 py-4 sm:px-6 sm:py-6 text-primary-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="size-6 text-accent" aria-hidden="true" />
            <div>
              <p className="text-sm text-primary-foreground/70">{data.data}</p>
              <h3 className="text-pretty font-serif text-2xl font-semibold">{romanizarLiturgia(data.liturgia)}</h3>
            </div>
          </div>
          <Badge className={cor.className}>Cor litúrgica: {cor.label}</Badge>
        </div>
      </div>

      {data.santoDoDia && (
        <div className="border-b border-[#d4af37]/30 bg-[#fff9e9] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0b4b35] text-[#f2cf62]">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a731d]">Santo do Dia</p>
              <h4 className="mt-1 font-serif text-xl font-semibold text-[#0b4b35]">{data.santoDoDia.nome}</h4>
              {data.santoDoDia.resumo && (
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[#625c50]">{data.santoDoDia.resumo}</p>
              )}
              <a
                href={data.santoDoDia.fonte}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0b4b35] underline-offset-4 hover:underline"
              >
                Conhecer o Santo do Dia na Canção Nova <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3 sm:px-6 sm:py-4">
        <Accordion defaultValue={["Evangelho"]}>
          <Bloco titulo="Primeira Leitura" itens={data.leituras.primeiraLeitura} />
          <Bloco titulo="Salmo Responsorial" itens={data.leituras.salmo} />
          <Bloco titulo="Segunda Leitura" itens={data.leituras.segundaLeitura} />
          <Bloco titulo="Evangelho" itens={data.leituras.evangelho} />
        </Accordion>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Fonte da Liturgia: Canção Nova</span>
          <a href={data.fonte.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
            Abrir fonte oficial
          </a>
        </div>
      </div>
    </div>
  )
}
