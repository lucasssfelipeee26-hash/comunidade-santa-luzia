"use client"

import { useEffect, useState } from "react"
import { BookOpen, CalendarX, CheckCircle2, Download, FileUp, Loader2, Trash2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FormacaoRow } from "@/lib/db"

function formatarData(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba" }).format(new Date(`${value}T12:00:00-04:00`)) }
function tamanho(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }

export function GerenciadorFormacoes() {
  const [itens, setItens] = useState<FormacaoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")

  async function carregar() {
    setLoading(true)
    try { const r = await fetch("/api/formacoes", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.erro); setItens(j.formacoes || []) }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar formações.") }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void carregar()
    const aoSincronizar = () => void carregar()
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    return () => window.removeEventListener("santa-luzia:server-sync", aoSincronizar)
  }, [])

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setErro("")
    try { const form = new FormData(e.currentTarget); const r = await fetch("/api/formacoes", { method: "POST", body: form }); const j = await r.json(); if (!r.ok) throw new Error(j.erro); e.currentTarget.reset(); await carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível publicar a formação.") }
    finally { setSaving(false) }
  }

  async function mudarStatus(item: FormacaoRow) {
    const cancelando = item.status !== "cancelada"
    const motivo = cancelando ? window.prompt("Motivo do cancelamento da formação:") : ""
    if (cancelando && !motivo?.trim()) return
    const r = await fetch(`/api/formacoes/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: cancelando ? "cancelada" : "agendada", motivo_cancelamento: motivo || "" }) })
    if (r.ok) carregar()
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta formação e o arquivo anexado?")) return
    const r = await fetch(`/api/formacoes/${id}`, { method: "DELETE" }); if (r.ok) carregar()
  }

  return <section className="mt-10 overflow-hidden rounded-xl border border-[#d4af37]/45 bg-card">
    <header className="border-b border-accent/35 bg-accent/10 px-5 py-4 text-foreground">
      <h2 className="flex items-center gap-2 font-serif text-2xl text-primary"><BookOpen className="size-5" /> Gerenciar Formação</h2>
      <p className="mt-1 text-sm text-muted-foreground">Publique o tema do encontro, avisos de cancelamento e materiais para leitura ou download.</p>
    </header>
    <form onSubmit={criar} className="grid gap-4 p-5 md:grid-cols-2" encType="multipart/form-data">
      <div className="space-y-2"><Label htmlFor="f-titulo">Título</Label><Input id="f-titulo" name="titulo" placeholder="Ex.: Formação mensal" required /></div>
      <div className="space-y-2"><Label htmlFor="f-tema">Tema da formação</Label><Input id="f-tema" name="tema" placeholder="Ex.: Partes da Santa Missa" required /></div>
      <div className="space-y-2"><Label htmlFor="f-data">Data</Label><Input id="f-data" name="data" type="date" required /></div>
      <div className="space-y-2"><Label htmlFor="f-horario">Horário</Label><Input id="f-horario" name="horario" type="time" /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="f-descricao">Orientações / conteúdo</Label><textarea id="f-descricao" name="descricao" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Resumo do conteúdo, materiais que levar, orientações..." /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="f-arquivo">Arquivo para os membros (opcional)</Label><Input id="f-arquivo" name="arquivo" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.odt,.odp,.txt" /><p className="text-xs text-muted-foreground">PDF, PowerPoint, Word, ODT/ODP ou TXT · máximo 20 MB.</p></div>
      <input type="hidden" name="status" value="agendada" />
      <div className="md:col-span-2">{erro && <p className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}<Button disabled={saving} className="gap-2">{saving ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Publicar formação</Button></div>
    </form>
    <div className="border-t border-border p-5">
      <h3 className="mb-3 font-semibold">Formações publicadas</h3>
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : itens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma formação publicada.</p> : <div className="space-y-3">{itens.map(item => <article key={item.id} className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong>{item.titulo}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "cancelada" ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-800"}`}>{item.status === "cancelada" ? "Cancelada" : "Agendada"}</span></div><p className="mt-1 text-sm font-medium text-primary">Tema: {item.tema}</p><p className="text-sm text-muted-foreground">{formatarData(item.data)}{item.horario ? ` às ${item.horario}` : ""}</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => mudarStatus(item)} className="gap-1">{item.status === "cancelada" ? <CheckCircle2 className="size-4" /> : <CalendarX className="size-4" />}{item.status === "cancelada" ? "Reativar" : "Cancelar"}</Button><Button type="button" size="sm" variant="outline" onClick={() => excluir(item.id)} className="text-destructive"><Trash2 className="size-4" /></Button></div></div>
        {item.motivo_cancelamento && <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive"><XCircle className="mr-1 inline size-4" /> {item.motivo_cancelamento}</p>}
        {item.arquivo && <a className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={`/api/formacoes/${item.id}/download`}><Download className="size-4" /> {item.arquivo.nome_original} ({tamanho(item.arquivo.tamanho)})</a>}
      </article>)}</div>}
    </div>
  </section>
}
