"use client"

import Link from "next/link"
import useSWR from "swr"
import { AlertCircle, BookOpen, CalendarDays, CheckCircle2, Database, Loader2, ScrollText } from "lucide-react"
import type { Liturgia } from "@/app/api/liturgia/route"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type LiturgiaApp = Liturgia & { dataIso?: string; origem?: "offline"; offline?: boolean; quizDisponivel?: boolean }

const fetcher = async (url: string) => {
  const resposta = await fetch(url, { cache: "no-store" })
  const json = await resposta.json().catch(() => null)
  if (!resposta.ok || !json) throw new Error(json?.erro || "Liturgia offline indisponível.")
  return json
}

const corMap: Record<string, string> = {
  Verde: "bg-[oklch(0.6_0.08_160)] text-white",
  Branco: "bg-secondary text-secondary-foreground border border-border",
  Vermelho: "bg-destructive text-white",
  Roxo: "bg-[oklch(0.5_0.09_300)] text-white",
  Rosa: "bg-[oklch(0.75_0.09_10)] text-white",
}

function Bloco({ titulo, itens, aberto = false }: { titulo: string; itens?: Liturgia["leituras"]["primeiraLeitura"]; aberto?: boolean }) {
  if (!itens?.length) return null
  return <Accordion defaultValue={aberto ? [titulo] : []}>
    <AccordionItem value={titulo}>
      <AccordionTrigger className="text-left font-serif text-xl text-primary hover:no-underline">
        <span className="flex flex-col">{titulo}{itens[0]?.referencia && <span className="text-sm font-normal text-muted-foreground">{itens[0].referencia}</span>}</span>
      </AccordionTrigger>
      <AccordionContent>{itens.map((item, i) => <div key={i} className="mb-4 last:mb-0">
        {item.titulo && <p className="mb-2 font-medium text-foreground">{item.titulo}</p>}
        {item.refrao && <p className="mb-2 font-semibold italic text-primary">R. {item.refrao}</p>}
        {item.texto && <p className="whitespace-pre-line text-pretty leading-7 text-foreground/90">{item.texto}</p>}
      </div>)}</AccordionContent>
    </AccordionItem>
  </Accordion>
}

export function LiturgiaDiaria() {
  const { data, error, isLoading } = useSWR<LiturgiaApp>("/api/liturgia-local", fetcher, { revalidateOnFocus: false, refreshInterval: 0 })

  if (isLoading) return <div className="flex items-center justify-center gap-3 rounded-2xl border bg-white/80 p-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Abrindo base litúrgica offline…</div>
  if (error || !data) return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
    <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0" /><div><strong>Liturgia offline indisponível para hoje.</strong><p className="mt-1 text-sm">O aplicativo não buscará outra fonte na internet e o Quiz Litúrgico também não será gerado até existir o arquivo offline da mesma data.</p></div></div>
  </div>

  function marcarLeituraConcluida() {
    if (!data?.dataIso) return
    try { localStorage.setItem(`santa-luzia:liturgia-lida:${data.dataIso}`, "1"); window.dispatchEvent(new CustomEvent("santa-luzia:liturgia-lida", { detail: { dataIso: data.dataIso } })) } catch {}
  }

  return <div className="overflow-hidden rounded-3xl border border-border/80 bg-white/90 shadow-sm">
    <div className="flex flex-wrap items-center gap-2 border-b bg-[#eef8f2] px-4 py-3 text-sm sm:px-6">
      <Database className="size-4 text-[#0b4b35]" /><strong className="text-[#0b4b35]">Base 100% offline</strong>
      <span className="text-xs text-muted-foreground">· sem consulta à Canção Nova, CNBB ou qualquer site durante a leitura</span>
    </div>

    <div className="bg-primary px-4 py-5 text-primary-foreground sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><BookOpen className="size-7 text-accent" /><div><p className="text-sm text-primary-foreground/70">{data.data}</p><h3 className="font-serif text-2xl font-semibold sm:text-3xl">{data.liturgia}</h3><p className="mt-1 text-xs text-primary-foreground/70">{data.tempoLiturgicoAtual}</p></div></div>
        <Badge className={corMap[data.cor] || "bg-secondary text-secondary-foreground"}>Cor: {data.cor}</Badge>
      </div>
    </div>

    <div className="p-3 sm:p-5">
      <Tabs defaultValue="leituras">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-secondary/60 p-1">
          <TabsTrigger value="leituras" className="min-h-11 text-xs"><ScrollText className="mr-1 size-4" />Leituras</TabsTrigger>
          <TabsTrigger value="evangelho" className="min-h-11 text-xs"><BookOpen className="mr-1 size-4" />Evangelho</TabsTrigger>
          <TabsTrigger value="dia" className="min-h-11 text-xs"><CalendarDays className="mr-1 size-4" />Dia</TabsTrigger>
        </TabsList>
        <TabsContent value="leituras" className="mt-3 rounded-2xl border bg-white/70 px-4 sm:px-5"><Bloco titulo="Primeira Leitura" itens={data.leituras.primeiraLeitura} aberto /><Bloco titulo="Salmo Responsorial" itens={data.leituras.salmo} aberto /><Bloco titulo="Segunda Leitura" itens={data.leituras.segundaLeitura} /></TabsContent>
        <TabsContent value="evangelho" className="mt-3 rounded-2xl border bg-white/70 px-4 sm:px-5"><Bloco titulo="Evangelho" itens={data.leituras.evangelho} aberto /></TabsContent>
        <TabsContent value="dia" className="mt-3 rounded-2xl border bg-white/70 p-4"><p className="text-sm leading-6">Ano litúrgico <strong>{data.anoLiturgico || "—"}</strong> · Ciclo dominical <strong>{data.cicloDominical || "—"}</strong> · Ciclo ferial <strong>{data.cicloFerial || "—"}</strong>.</p><p className="mt-2 text-xs text-muted-foreground">Origem interna: {data.fonte?.nome}. {data.fonte?.licenca}</p></TabsContent>
      </Tabs>

      {data.quizDisponivel && <div className="mt-6 rounded-2xl border border-accent/45 bg-[#fffaf0] p-4">
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><div><h4 className="font-serif text-lg font-semibold text-primary">Quiz alinhado com esta Liturgia</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">O Quiz de hoje é criado automaticamente a partir deste mesmo arquivo offline. Se este arquivo não existir, o Quiz não aparece.</p></div></div>
        <Link href="/area-restrita/ranking" onClick={marcarLeituraConcluida} className={`${buttonVariants({ size: "lg" })} mt-3 w-full sm:w-auto`}>Concluir leitura e abrir Quiz</Link>
      </div>}
    </div>
  </div>
}
