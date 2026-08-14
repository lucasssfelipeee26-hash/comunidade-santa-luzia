"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { AlertCircle, CalendarDays, CheckCircle2, Clock, Cross, RefreshCw, Users, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ordemFuncaoEscala } from "@/lib/escala-funcoes"
import { carregarCacheEscalas, salvarCacheEscalas } from "@/lib/offline-data"

type PessoaEscala = {
  id?: string
  nome: string
  funcao: string
  categoria: "sacerdote" | "acolito" | "coroinha"
}

type Escala = {
  id: string
  data: string
  horario: string
  celebrante: string
  pessoas: PessoaEscala[]
  observacoes: string
}

type EscalasResponse = { ok: boolean; escalas: Escala[]; erro?: string }
type EscalasCache = { atualizadoEm: number; dados: EscalasResponse }

async function fetcher(url: string): Promise<EscalasResponse> {
  const response = await fetch(url, { cache: "no-store" })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json) throw new Error(json?.erro ?? "Não foi possível carregar a escala.")
  return json
}

function hojeCuiaba() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return `${mapa.year}-${mapa.month}-${mapa.day}`
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number)
  if (!ano || !mes || !dia) return data
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12)))
}

export function EscalaPublica() {
  const [cacheLocal, setCacheLocal] = useState<EscalasCache | null>(null)
  const [online, setOnline] = useState(true)
  const { data, error, isLoading, mutate } = useSWR<EscalasResponse>("/api/escalas", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  })

  useEffect(() => {
    setCacheLocal(carregarCacheEscalas<EscalasResponse>())
    const atualizarRede = () => setOnline(navigator.onLine)
    atualizarRede()
    window.addEventListener("online", atualizarRede)
    window.addEventListener("offline", atualizarRede)
    return () => {
      window.removeEventListener("online", atualizarRede)
      window.removeEventListener("offline", atualizarRede)
    }
  }, [])

  useEffect(() => {
    if (!data?.ok || !navigator.onLine) return
    salvarCacheEscalas(data)
    setCacheLocal({ atualizadoEm: Date.now(), dados: data })
  }, [data])

  const dadosExibidos = data?.ok ? data : cacheLocal?.dados
  const usandoCache = Boolean(dadosExibidos && (error || !online))

  if (isLoading && !dadosExibidos) {
    return <p className="text-muted-foreground">Carregando escala...</p>
  }

  if (error && !dadosExibidos) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <AlertCircle className="size-5" /> Não foi possível carregar a Escala do Dia.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
          <RefreshCw className="size-4" /> Tentar novamente
        </Button>
      </div>
    )
  }

  const hoje = hojeCuiaba()
  const proximas = (dadosExibidos?.escalas ?? [])
    .filter((escala) => escala.data >= hoje)
    .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`))
    .slice(0, 12)

  if (!proximas.length) {
    return (
      <div className="rounded-xl border bg-card p-6 text-muted-foreground">
        Nenhuma escala publicada para hoje ou para os próximos dias.
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${usandoCache ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        {usandoCache ? <WifiOff className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
        <span>
          {usandoCache
            ? `Sem conexão: mostrando a última escala salva${cacheLocal?.atualizadoEm ? ` em ${new Date(cacheLocal.atualizadoEm).toLocaleString("pt-BR")}` : ""}.`
            : "Escala atualizada e salva neste aparelho para consulta sem internet."}
        </span>
      </div>
      {proximas.map((escala) => (
        <article key={escala.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 font-semibold capitalize text-primary">
              <CalendarDays className="size-4" /> {formatarData(escala.data)}
            </span>
            <span className="flex items-center gap-2 text-sm">
              <Clock className="size-4" /> {escala.horario}
            </span>
          </div>

          <div className="mb-4 rounded-lg bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-medium">
              <Cross className="size-4" /> Celebrante: {escala.celebrante}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Grupo titulo="Acólitos" itens={escala.pessoas.filter((p) => p.categoria === "acolito").sort((a, b) => ordemFuncaoEscala(a.funcao) - ordemFuncaoEscala(b.funcao))} />
            <Grupo titulo="Coroinhas" itens={escala.pessoas.filter((p) => p.categoria === "coroinha").sort((a, b) => ordemFuncaoEscala(a.funcao) - ordemFuncaoEscala(b.funcao))} />
          </div>

          {escala.observacoes && (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <strong>Observações:</strong> {escala.observacoes}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}

function Grupo({ titulo, itens }: { titulo: string; itens: PessoaEscala[] }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-serif text-lg text-primary">
        <Users className="size-4" /> {titulo}
      </h3>
      {!itens.length ? (
        <p className="text-sm text-muted-foreground">Nenhum nome informado.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((pessoa, index) => (
            <li key={pessoa.id ?? index} className="rounded-md border px-3 py-2 text-sm">
              <strong>{pessoa.nome}</strong>
              <span className="text-muted-foreground"> · {pessoa.funcao}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
