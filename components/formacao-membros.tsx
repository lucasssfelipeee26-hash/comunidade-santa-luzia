"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, BookOpen, CalendarDays, Download, FileText } from "lucide-react"
import type { FormacaoRow } from "@/lib/db"

function formatarData(value: string) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Cuiaba" }).format(new Date(`${value}T12:00:00-04:00`)) }
function tamanho(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }

export function FormacaoMembros() {
  const [itens, setItens] = useState<FormacaoRow[]>([])
  const [erro, setErro] = useState("")
  useEffect(() => { fetch("/api/formacoes", { cache: "no-store" }).then(async r => { const j=await r.json(); if(!r.ok) throw new Error(j.erro); setItens(j.formacoes || []) }).catch(e => setErro(e.message)) }, [])
  const ordenados = useMemo(() => [...itens].sort((a,b)=>a.data.localeCompare(b.data)), [itens])
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
  const proximos = ordenados.filter(i => i.data >= hoje)
  const passados = [...ordenados].filter(i => i.data < hoje).reverse()

  if (erro) return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">{erro}</div>
  return <div className="space-y-8">
    <section><h2 className="mb-4 flex items-center gap-2 font-serif text-3xl text-[#0b4b35]"><CalendarDays className="size-6 text-[#9a731d]" /> Próximas formações</h2>{proximos.length === 0 ? <p className="rounded-xl border bg-white p-5 text-muted-foreground">Nenhuma formação futura publicada no momento.</p> : <div className="grid gap-5 md:grid-cols-2">{proximos.map(item => <Card key={item.id} item={item} />)}</div>}</section>
    {passados.length > 0 && <section><h2 className="mb-4 flex items-center gap-2 font-serif text-2xl text-[#0b4b35]"><BookOpen className="size-5 text-[#9a731d]" /> Materiais de formações anteriores</h2><div className="grid gap-5 md:grid-cols-2">{passados.map(item => <Card key={item.id} item={item} />)}</div></section>}
  </div>
}

function Card({ item }: { item: FormacaoRow }) {
  return <article className={`rounded-xl border bg-white p-5 shadow-sm ${item.status === "cancelada" ? "border-destructive/40" : "border-[#d4af37]/35"}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#9a731d]">{formatarData(item.data)}{item.horario ? ` · ${item.horario}` : ""}</p><h3 className="mt-2 font-serif text-2xl text-[#123f2e]">{item.titulo}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "cancelada" ? "bg-destructive/10 text-destructive" : "bg-[#073b29]/10 text-[#073b29]"}`}>{item.status === "cancelada" ? "CANCELADA" : "CONFIRMADA"}</span></div>
    <p className="mt-3 font-semibold text-[#7f5e15]">Tema: {item.tema}</p>
    {item.descricao && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5f5a4e]">{item.descricao}</p>}
    {item.status === "cancelada" && <div className="mt-4 flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span><strong>Formação cancelada.</strong>{item.motivo_cancelamento ? ` ${item.motivo_cancelamento}` : ""}</span></div>}
    {item.arquivo && <a href={`/api/formacoes/${item.id}/download`} className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#d4af37] bg-[#fffaf0] px-4 py-2.5 text-sm font-semibold text-[#755611] hover:bg-[#d4af37] hover:text-[#073b29]"><Download className="size-4" /> Baixar {item.arquivo.nome_original} <span className="text-xs opacity-70">({tamanho(item.arquivo.tamanho)})</span></a>}
    {!item.arquivo && <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-4" /> Sem arquivo anexado.</p>}
  </article>
}
