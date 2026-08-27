"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { AlertCircle, CalendarDays, CheckCircle2, Clock, Cross, Filter, History, Loader2, RefreshCw, Search, ShieldCheck, Users, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ordemFuncaoEscala } from "@/lib/escala-funcoes"
import { carregarCacheEscalas, salvarCacheEscalas } from "@/lib/offline-data"

type PessoaEscala = { id?: string; nome: string; funcao: string; categoria: "sacerdote" | "acolito" | "coroinha" }
type Escala = {
  id: string; data: string; horario: string; celebrante: string; pessoas: PessoaEscala[]; observacoes: string
  celebracao_liturgica?: string | null; tempo_liturgico?: string | null; cor_liturgica?: string | null; ciclo_dominical?: string | null; data_liturgica?: string | null
  minha_justificativa?: { id: string; justificativa: string; criado_em: number } | null
}
type EscalasResponse = { ok: boolean; escalas: Escala[]; usuarioId?: string | null; tipoUsuario?: "moderador" | "membro" | null; erro?: string }
type EscalasCache = { atualizadoEm: number; dados: EscalasResponse }
type LiturgiaDaEscala = { liturgia: string; tempoLiturgicoAtual: string; tempoCategoria?: string; cor: string; cicloDominical?: string; dataIso: string }
type AbaEscala = "proximas" | "historico"

async function fetcher(url: string): Promise<EscalasResponse> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json) throw new Error(json?.erro ?? "Não foi possível carregar as escalas.")
  return json
}
function hojeCuiaba() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return `${mapa.year}-${mapa.month}-${mapa.day}`
}
function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number)
  if (!ano || !mes || !dia) return data
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(Date.UTC(ano, mes - 1, dia, 12)))
}
function normalizar(value?: string | null) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() }

export function EscalaPublica() {
  const [cacheLocal, setCacheLocal] = useState<EscalasCache | null>(null)
  const [online, setOnline] = useState(true)
  const [windowsBeta, setWindowsBeta] = useState(false)
  const [liturgias, setLiturgias] = useState<Record<string, LiturgiaDaEscala>>({})
  const [aba, setAba] = useState<AbaEscala>("proximas")
  const [filtroData, setFiltroData] = useState("")
  const [filtroTempo, setFiltroTempo] = useState("todos")
  const { data, error, isLoading, mutate } = useSWR<EscalasResponse>("/api/escalas", fetcher, { refreshInterval: 60_000, revalidateOnFocus: true })

  useEffect(() => {
    setWindowsBeta(navigator.userAgent.includes("SantaLuziaWindowsBeta/"))
    setCacheLocal(carregarCacheEscalas<EscalasResponse>())
    const atualizarRede = () => setOnline(navigator.onLine)
    atualizarRede(); window.addEventListener("online", atualizarRede); window.addEventListener("offline", atualizarRede)
    return () => { window.removeEventListener("online", atualizarRede); window.removeEventListener("offline", atualizarRede) }
  }, [])
  useEffect(() => {
    if (!data?.ok || !navigator.onLine) return
    salvarCacheEscalas(data); setCacheLocal({ atualizadoEm: Date.now(), dados: data })
  }, [data])
  useEffect(() => {
    if (!windowsBeta) return
    const escalas = data?.escalas ?? cacheLocal?.dados?.escalas ?? []
    void Promise.all(escalas.map(async (escala) => {
      if (escala.celebracao_liturgica) return [escala.id, { liturgia: escala.celebracao_liturgica, tempoLiturgicoAtual: escala.tempo_liturgico || "", cor: escala.cor_liturgica || "—", cicloDominical: escala.ciclo_dominical || "", dataIso: escala.data_liturgica || escala.data }] as const
      const [ano, mes, dia] = escala.data.split("-").map(Number)
      const dataCivil = new Date(Date.UTC(ano, mes - 1, dia)); const proximoDia = new Date(dataCivil); proximoDia.setUTCDate(proximoDia.getUTCDate() + 1)
      const buscar = async (dataIso: string) => { const response = await fetch(`/api/liturgia?data=${dataIso}`, { cache: "force-cache", headers: { "X-Santa-Luzia-Windows-Beta": "1" } }); return response.ok ? await response.json() as LiturgiaDaEscala : null }
      let liturgia = await buscar(dataCivil.toISOString().slice(0, 10))
      if (dataCivil.getUTCDay() === 6) liturgia = await buscar(proximoDia.toISOString().slice(0, 10)) || liturgia
      else { const vespera = await buscar(proximoDia.toISOString().slice(0, 10)); if (vespera && /solenidade/i.test(vespera.tempoCategoria || "") && !/natal/i.test(vespera.liturgia || "")) liturgia = vespera }
      return liturgia ? [escala.id, liturgia] as const : null
    })).then((itens) => setLiturgias(Object.fromEntries(itens.filter((item): item is readonly [string, LiturgiaDaEscala] => Boolean(item)))))
  }, [windowsBeta, data, cacheLocal])

  const dadosExibidos = data?.ok ? data : cacheLocal?.dados
  const usandoCache = Boolean(dadosExibidos && (error || !online))
  const hoje = hojeCuiaba()
  const todas = dadosExibidos?.escalas ?? []
  const proximas = useMemo(() => todas.filter((escala) => escala.data >= hoje).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`)).slice(0, 24), [todas, hoje])
  const historicoCompleto = useMemo(() => todas.filter((escala) => escala.data < hoje).sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`)).slice(0, 120), [todas, hoje])
  const temposHistoricos = useMemo(() => [...new Set(historicoCompleto.map((escala) => escala.tempo_liturgico?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [historicoCompleto])
  const historicoFiltrado = useMemo(() => historicoCompleto.filter((escala) => {
    if (filtroData && escala.data !== filtroData) return false
    if (filtroTempo !== "todos" && normalizar(escala.tempo_liturgico) !== normalizar(filtroTempo)) return false
    return true
  }), [historicoCompleto, filtroData, filtroTempo])
  const filtrosAtivos = Boolean(filtroData || filtroTempo !== "todos")
  const historicoExibido = filtrosAtivos ? historicoFiltrado : historicoCompleto.slice(0, 6)

  if (isLoading && !dadosExibidos) return <p className="text-muted-foreground">Carregando escalas...</p>
  if (error && !dadosExibidos) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6"><p className="flex items-center gap-2 font-medium text-destructive"><AlertCircle className="size-5" /> Não foi possível carregar as escalas.</p><p className="mt-2 text-sm text-muted-foreground">{error.message}</p><Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => mutate()}><RefreshCw className="size-4" /> Tentar novamente</Button></div>

  const lista = aba === "proximas" ? proximas : historicoExibido

  return (
    <div className="grid gap-4" data-escala-history-enabled="true" data-escala-history-search="date-liturgical-season">
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${usandoCache ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        {usandoCache ? <WifiOff className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
        <span>{usandoCache ? `Sem conexão: mostrando as escalas e o histórico salvos${cacheLocal?.atualizadoEm ? ` em ${new Date(cacheLocal.atualizadoEm).toLocaleString("pt-BR")}` : ""}.` : "Próximas escalas e histórico atualizados e salvos neste aparelho para consulta sem internet."}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-white/80 p-1.5 shadow-sm" role="tablist" aria-label="Período das escalas">
        <button type="button" role="tab" aria-selected={aba === "proximas"} onClick={() => setAba("proximas")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition ${aba === "proximas" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><CalendarDays className="size-4" />Próximas <span className={`rounded-full px-2 py-0.5 text-[9px] ${aba === "proximas" ? "bg-white/15" : "bg-muted"}`}>{proximas.length}</span></button>
        <button type="button" role="tab" aria-selected={aba === "historico"} onClick={() => setAba("historico")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition ${aba === "historico" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><History className="size-4" />Histórico <span className={`rounded-full px-2 py-0.5 text-[9px] ${aba === "historico" ? "bg-white/15" : "bg-muted"}`}>{historicoCompleto.length}</span></button>
      </div>

      {aba === "historico" && (
        <section className="rounded-2xl border bg-white/85 p-3 shadow-sm" data-escala-history-filters="true">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary"><Search className="size-4" />Encontrar escala antiga</div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Data<input type="date" value={filtroData} onChange={(event) => setFiltroData(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-xs font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary" data-escala-filter-date="true" /></label>
            <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Tempo litúrgico<select value={filtroTempo} onChange={(event) => setFiltroTempo(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-xs font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary" data-escala-filter-season="true"><option value="todos">Todos os tempos litúrgicos</option>{temposHistoricos.map((tempo) => <option key={tempo} value={tempo}>{tempo}</option>)}</select></label>
            <Button type="button" variant="outline" className="self-end gap-2" disabled={!filtrosAtivos} onClick={() => { setFiltroData(""); setFiltroTempo("todos") }}><Filter className="size-4" />Limpar</Button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{filtrosAtivos ? `${historicoFiltrado.length} escala(s) encontrada(s).` : `Mostrando somente as ${Math.min(6, historicoCompleto.length)} escalas anteriores mais recentes. Use data ou tempo litúrgico para localizar as demais.`}</p>
        </section>
      )}

      {lista.length === 0 ? <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{aba === "proximas" ? "Nenhuma escala publicada para hoje ou para os próximos dias." : "Nenhuma escala histórica corresponde aos filtros informados."}</div> : (
        <div className="grid gap-5">
          {lista.map((escala, index) => <EscalaCard key={escala.id} escala={escala} historico={aba === "historico"} destaque={aba === "proximas" && index === 0} windowsBeta={windowsBeta} liturgia={liturgias[escala.id]} usuarioId={dadosExibidos?.usuarioId ?? null} onAtualizada={() => void mutate()} />)}
        </div>
      )}
    </div>
  )
}

function EscalaCard({ escala, historico, destaque, windowsBeta, liturgia, usuarioId, onAtualizada }: { escala: Escala; historico: boolean; destaque?: boolean; windowsBeta: boolean; liturgia?: LiturgiaDaEscala; usuarioId: string | null; onAtualizada: () => void }) {
  return (
    <article className={`rounded-2xl border bg-card p-5 shadow-sm ${historico ? "border-border/80 opacity-[.96]" : destaque ? "border-[#d4af37] ring-1 ring-[#d4af37]/25" : "border-border"}`} data-windows-beta-scale={windowsBeta ? escala.id : undefined} data-escala-historico={historico ? "true" : "false"} data-escala-recente={destaque ? "true" : undefined}>
      <div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0 flex-1">{destaque && <span className="mb-2 inline-flex rounded-full bg-[#fff1bd] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#72520d]">Próxima escala</span>}{windowsBeta && liturgia && <div className="mb-4 rounded-2xl border border-primary/10 bg-[linear-gradient(145deg,#fffaf3,#fff)] p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a731d]">Celebração litúrgica</p><h2 className="mt-1 font-serif text-xl font-semibold text-primary">{liturgia.liturgia}</h2><p className="mt-1 text-xs text-muted-foreground">{liturgia.tempoLiturgicoAtual} · Ano {liturgia.cicloDominical || "—"} · Cor {liturgia.cor}</p></div>}</div>{historico && <span className="shrink-0 rounded-full border border-[#d7cbbf] bg-[#f8f3ed] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#75655f]">Realizada</span>}</div>
      <div className="mb-4 flex flex-wrap items-center gap-4"><span className="flex items-center gap-2 font-semibold capitalize text-primary"><CalendarDays className="size-4" /> {formatarData(escala.data)}</span><span className="flex items-center gap-2 text-sm"><Clock className="size-4" /> {escala.horario}</span></div>
      {escala.tempo_liturgico && <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-[#9a731d]">{escala.tempo_liturgico}</p>}
      <div className="mb-4 rounded-xl border border-primary/10 bg-primary/5 p-4"><p className="flex items-center gap-2 font-medium"><Cross className="size-4" /> Celebrante: {escala.celebrante}</p></div>
      {!historico && windowsBeta && usuarioId && escala.pessoas.some((pessoa) => pessoa.id === usuarioId) && <JustificarAusenciaEscala escala={escala} onAtualizada={onAtualizada} />}
      <div className="grid gap-4 md:grid-cols-2"><Grupo titulo="Acólitos" compacto={windowsBeta} itens={escala.pessoas.filter((p) => p.categoria === "acolito").sort((a, b) => ordemFuncaoEscala(a.funcao) - ordemFuncaoEscala(b.funcao))} /><Grupo titulo="Coroinhas" compacto={windowsBeta} itens={escala.pessoas.filter((p) => p.categoria === "coroinha").sort((a, b) => ordemFuncaoEscala(a.funcao) - ordemFuncaoEscala(b.funcao))} /></div>
      {escala.observacoes && <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"><strong>Observações:</strong> {escala.observacoes}</p>}
    </article>
  )
}

function Grupo({ titulo, itens, compacto = false }: { titulo: string; itens: PessoaEscala[]; compacto?: boolean }) {
  return <div><h3 className="mb-2 flex items-center gap-2 font-serif text-lg text-primary"><Users className="size-4" /> {titulo}</h3>{!itens.length ? <p className="text-sm text-muted-foreground">Nenhum nome informado.</p> : <ul className={compacto ? "divide-y overflow-hidden rounded-2xl border bg-white" : "space-y-2"}>{itens.map((pessoa, index) => <li key={pessoa.id ?? index} className={compacto ? "flex items-center justify-between gap-3 px-3 py-2.5 text-sm" : "rounded-md border px-3 py-2 text-sm"}><strong>{compacto ? (() => { const partes = pessoa.nome.split(/\s+/).filter(Boolean); return partes.length > 1 ? `${partes[0]} ${partes.at(-1)}` : pessoa.nome })() : pessoa.nome}</strong><span className={compacto ? "rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-bold text-primary" : "text-muted-foreground"}>{compacto ? pessoa.funcao : ` · ${pessoa.funcao}`}</span></li>)}</ul>}</div>
}

function JustificarAusenciaEscala({ escala, onAtualizada }: { escala: Escala; onAtualizada: () => void }) {
  const [aberto, setAberto] = useState(false); const [justificativa, setJustificativa] = useState(""); const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState("")
  if (escala.minha_justificativa) return <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4" /> Falta justificada</p><p className="mt-1 text-xs leading-5">{escala.minha_justificativa.justificativa}</p><p className="mt-1 text-[10px] opacity-75">Registro confirmado e bloqueado para alterações.</p></div>
  async function enviar() {
    if (justificativa.trim().length < 3) { setErro("Informe o motivo da ausência."); return }
    setSalvando(true); setErro("")
    const response = await fetch(`/api/escalas/${escala.id}/minha-justificativa`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Santa-Luzia-Windows-Beta": "1" }, body: JSON.stringify({ justificativa: justificativa.trim() }) })
    const json = await response.json().catch(() => null)
    if (!response.ok) { setErro(json?.erro || "Não foi possível registrar a justificativa."); setSalvando(false); return }
    setSalvando(false); setAberto(false); onAtualizada(); window.dispatchEvent(new Event("santa-luzia:server-sync"))
  }
  return <div className="mt-4 rounded-2xl border border-primary/10 bg-[#fffaf7] p-3"><button type="button" onClick={() => setAberto((valor) => !valor)} className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm font-bold text-primary"><span>Não poderá comparecer?</span><span className="rounded-full bg-primary px-3 py-1 text-[10px] text-white">Justificar falta</span></button>{aberto && <div className="mt-3 border-t pt-3"><label htmlFor={`justificativa-escala-${escala.id}`} className="text-xs font-semibold">Motivo da ausência</label><textarea id={`justificativa-escala-${escala.id}`} value={justificativa} onChange={(event) => setJustificativa(event.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-primary" placeholder="Explique por que não poderá participar da missa" /><Button type="button" size="sm" onClick={() => void enviar()} disabled={salvando} className="mt-2 gap-2">{salvando && <Loader2 className="size-4 animate-spin" />}{salvando ? "Salvando…" : "Confirmar falta justificada"}</Button>{erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}</div>}</div>
}
