"use client"

import Link from "next/link"
import useSWR from "swr"
import { AlertCircle, BookOpen, CalendarDays, CheckCircle2, ExternalLink, ImageIcon, Loader2, ScrollText, Sparkles } from "lucide-react"
import type { Liturgia } from "@/app/api/liturgia/route"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type LiturgiaApp = Liturgia & {
  dataIso?: string
  cicloDominical?: "A" | "B" | "C"
  cicloFerial?: "I" | "II"
  anoLiturgico?: number
  origem?: "local" | "online"
  imagem?: string | null
  fonte: Liturgia["fonte"] & { licenca?: string }
  santoDoDia?: (NonNullable<Liturgia["santoDoDia"]> & { imagem?: string | null }) | null
}

const fetcher = async (url: string) => {
  const resposta = await fetch(url, { cache: "no-store" })
  const json = await resposta.json().catch(() => null)
  if (!resposta.ok || !json) throw new Error(json?.error || "Não foi possível carregar a Liturgia Diária.")
  return json
}

function toRoman(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 40) return String(value)
  const pares: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
  let n = value
  let out = ""
  for (const [decimal, roman] of pares) {
    while (n >= decimal) { out += roman; n -= decimal }
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

function Bloco({ titulo, itens, aberto = false }: { titulo: string; itens?: Liturgia["leituras"]["primeiraLeitura"]; aberto?: boolean }) {
  if (!itens?.length) return null
  return (
    <Accordion type="multiple" defaultValue={aberto ? [titulo] : []}>
      <AccordionItem value={titulo}>
        <AccordionTrigger className="text-left font-serif text-xl text-primary hover:no-underline">
          <span className="flex flex-col">
            {titulo}
            {itens[0]?.referencia && <span className="text-sm font-normal text-muted-foreground">{itens[0].referencia}</span>}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {itens.map((item, i) => (
            <div key={i} className="mb-4 last:mb-0">
              {item.titulo && <p className="mb-2 font-medium text-foreground">{item.titulo}</p>}
              {item.refrao && <p className="mb-2 font-semibold italic text-primary">R. {item.refrao}</p>}
              {item.texto && <p className="whitespace-pre-line text-pretty leading-7 text-foreground/90">{item.texto}</p>}
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function Oracao({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4">
      <h4 className="font-serif text-lg font-semibold text-primary">{titulo}</h4>
      {texto ? <p className="mt-2 whitespace-pre-line leading-7 text-foreground/90">{texto}</p> : <p className="mt-2 text-sm text-muted-foreground">Esta oração ainda não está disponível na base de conteúdo deste dia.</p>}
    </div>
  )
}

export function LiturgiaDiaria() {
  const { data, error, isLoading } = useSWR<LiturgiaApp>("/api/liturgia-local", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000,
  })

  if (isLoading) return <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-white/80 p-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Carregando a Liturgia Diária…</div>
  if (error || !data) return <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive"><AlertCircle className="size-5 shrink-0" />Não foi possível carregar a Liturgia Diária neste momento.</div>

  const cor = corMap[data.cor] ?? { label: data.cor || "Litúrgica", className: "bg-secondary text-secondary-foreground" }
  const fonteUrl = data.fonte?.url

  function marcarLeituraConcluida() {
    if (!data?.dataIso) return
    try {
      localStorage.setItem(`santa-luzia:liturgia-lida:${data.dataIso}`, "1")
      window.dispatchEvent(new CustomEvent("santa-luzia:liturgia-lida", { detail: { dataIso: data.dataIso } }))
    } catch {}
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-white/85 shadow-[0_18px_50px_rgba(82,49,25,.08)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/10 px-4 py-3 text-sm sm:px-6">
        <CalendarDays className="size-4 text-accent-foreground" />
        <span className="font-semibold text-foreground">{romanizarLiturgia(data.tempoLiturgicoAtual)}</span>
        {data.cicloDominical && <Badge variant="outline">Ano {data.cicloDominical}</Badge>}
        {data.cicloFerial && <Badge variant="outline">Ferial {data.cicloFerial}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{data.origem === "local" ? "Conteúdo local" : "Fonte temporária online"}</span>
      </div>

      <div className="bg-primary px-4 py-5 text-primary-foreground sm:px-6 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="size-7 text-accent" />
            <div><p className="text-sm text-primary-foreground/70">{data.data}</p><h3 className="text-pretty font-serif text-2xl font-semibold sm:text-3xl">{romanizarLiturgia(data.liturgia)}</h3></div>
          </div>
          <Badge className={cor.className}>Cor: {cor.label}</Badge>
        </div>
      </div>

      {data.imagem && (
        <div className="relative max-h-80 overflow-hidden bg-secondary">
          <img src={data.imagem} alt={`Imagem litúrgica de ${data.liturgia}`} className="h-auto max-h-80 w-full object-cover" loading="lazy" />
        </div>
      )}

      {data.santoDoDia && (
        <div className="border-b border-[#d4af37]/30 bg-[#fff9e9] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex gap-4">
            {data.santoDoDia.imagem ? <img src={data.santoDoDia.imagem} alt={data.santoDoDia.nome} className="size-14 shrink-0 rounded-2xl object-cover" loading="lazy" /> : <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b4b35] text-[#f2cf62]"><Sparkles className="size-5" /></div>}
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a731d]">Santo do Dia</p><h4 className="mt-1 font-serif text-xl font-semibold text-[#0b4b35]">{data.santoDoDia.nome}</h4>{data.santoDoDia.resumo && <p className="mt-2 max-w-4xl text-sm leading-6 text-[#625c50]">{data.santoDoDia.resumo}</p>}</div>
          </div>
        </div>
      )}

      <div className="p-3 sm:p-5">
        <Tabs defaultValue="leituras">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-2xl bg-secondary/60 p-1">
            <TabsTrigger value="leituras" className="min-h-11 px-1 text-[10px] sm:text-xs"><ScrollText className="mr-1 size-4" />Leituras</TabsTrigger>
            <TabsTrigger value="evangelho" className="min-h-11 px-1 text-[10px] sm:text-xs"><BookOpen className="mr-1 size-4" />Evangelho</TabsTrigger>
            <TabsTrigger value="oracoes" className="min-h-11 px-1 text-[10px] sm:text-xs"><Sparkles className="mr-1 size-4" />Orações</TabsTrigger>
            <TabsTrigger value="dia" className="min-h-11 px-1 text-[10px] sm:text-xs"><ImageIcon className="mr-1 size-4" />Dia</TabsTrigger>
          </TabsList>

          <TabsContent value="leituras" className="mt-3 rounded-2xl border border-border bg-white/70 px-4 sm:px-5">
            <Bloco titulo="Primeira Leitura" itens={data.leituras.primeiraLeitura} aberto />
            <Bloco titulo="Salmo Responsorial" itens={data.leituras.salmo} aberto />
            <Bloco titulo="Segunda Leitura" itens={data.leituras.segundaLeitura} />
          </TabsContent>

          <TabsContent value="evangelho" className="mt-3 rounded-2xl border border-border bg-white/70 px-4 sm:px-5">
            <Bloco titulo="Evangelho" itens={data.leituras.evangelho} aberto />
          </TabsContent>

          <TabsContent value="oracoes" className="mt-3 grid gap-3">
            <Oracao titulo="Oração da Coleta" texto={data.oracoes?.coleta} />
            <Oracao titulo="Oração sobre as Oferendas" texto={data.oracoes?.oferendas} />
            <Oracao titulo="Oração depois da Comunhão" texto={data.oracoes?.comunhao} />
          </TabsContent>

          <TabsContent value="dia" className="mt-3 rounded-2xl border border-border bg-white/70 p-4">
            <p className="text-sm leading-6 text-muted-foreground">Ano litúrgico <strong className="text-foreground">{data.anoLiturgico || "—"}</strong> · Ciclo dominical <strong className="text-foreground">{data.cicloDominical || "—"}</strong> · Ciclo ferial <strong className="text-foreground">{data.cicloFerial || "—"}</strong>.</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Esta área está preparada para receber a imagem própria/licenciada de cada celebração junto com a base litúrgica local.</p>
          </TabsContent>
        </Tabs>

        <div className="mt-6 rounded-2xl border border-accent/45 bg-[linear-gradient(135deg,#fffaf0,#fff_55%,#f9edc8)] p-4">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><div><h4 className="font-serif text-lg font-semibold text-primary">Terminou a leitura?</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">O Quiz Litúrgico só é liberado depois que você concluir a Liturgia de hoje. As perguntas usam o mesmo conteúdo apresentado acima.</p></div></div>
          <Button asChild className="mt-3 w-full sm:w-auto" onClick={marcarLeituraConcluida}><Link href="/area-restrita/ranking">Concluir leitura e ir ao Quiz</Link></Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Fonte atual: {data.fonte?.nome || "Base litúrgica do aplicativo"}{data.fonte?.licenca ? ` · ${data.fonte.licenca}` : ""}</span>
          {fonteUrl && <a href={fonteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Ver fonte <ExternalLink className="size-3" /></a>}
        </div>
      </div>
    </div>
  )
}
