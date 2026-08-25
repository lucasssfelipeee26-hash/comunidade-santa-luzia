"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Download, Gauge, RefreshCw, ShieldCheck, Trash2, Wifi, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"

type EventoDiagnostico = {
  id: string
  at: number
  type: string
  level: "info" | "warning" | "error"
  route?: string
  durationMs?: number
  fps?: number
  status?: number
  path?: string
  message?: string
  [key: string]: unknown
}

type SnapshotDiagnostico = {
  generatedAt: string
  app: { version: string; route: string }
  network: { physical: string; native?: { connected?: boolean; connectionType?: string } }
  storage: { localStorageApproxBytes?: number; caches?: Array<{ name: string; entries: number }>; indexedDB?: Array<{ name: string; version: number }> }
  summary: {
    errors: number
    warnings: number
    slowRequests: number
    lowFpsSamples: number
    scrollJumps: number
    missingIconAudits: number
  }
  events: EventoDiagnostico[]
}

type AuditorApi = {
  version: string
  getEvents(): EventoDiagnostico[]
  snapshot(): Promise<SnapshotDiagnostico>
  runSelfAudit(): Promise<SnapshotDiagnostico>
  exportReport(): Promise<SnapshotDiagnostico>
  clear(): void
}

function auditor(): AuditorApi | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { SantaLuziaAuditor?: AuditorApi }).SantaLuziaAuditor ?? null
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function resumoEvento(evento: EventoDiagnostico) {
  if (evento.type === "javascript-error" || evento.type === "unhandled-rejection") return String(evento.message || "Erro JavaScript")
  if (evento.type === "fetch" || evento.type === "fetch-error") return `${evento.path || "Requisição"}${evento.status ? ` · HTTP ${evento.status}` : ""}${evento.durationMs ? ` · ${evento.durationMs} ms` : ""}`
  if (evento.type === "route-transition") return `Transição de tela · ${evento.durationMs ?? 0} ms`
  if (evento.type === "fps-sample") return `Taxa de quadros · ${evento.fps ?? 0} FPS`
  if (evento.type === "scroll-jump") return "Salto anormal detectado na rolagem"
  if (evento.type === "missing-icons") return "Ícone esperado não encontrado"
  if (evento.type === "offline-functional-audit") return "Auditoria das funções offline"
  if (evento.type === "long-task") return `Tarefa pesada · ${evento.durationMs ?? 0} ms`
  return evento.type.replace(/-/g, " ")
}

function Nivel({ value }: { value: EventoDiagnostico["level"] }) {
  const classes = value === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : value === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-800"
  const label = value === "error" ? "Erro" : value === "warning" ? "Atenção" : "Info"
  return <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${classes}`}>{label}</span>
}

export function DiagnosticoSantaLuzia() {
  const [snapshot, setSnapshot] = useState<SnapshotDiagnostico | null>(null)
  const [executando, setExecutando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [mensagem, setMensagem] = useState("")

  const atualizar = useCallback(async () => {
    const api = auditor()
    if (!api) return
    try { setSnapshot(await api.snapshot()) } catch {}
  }, [])

  useEffect(() => {
    void atualizar()
    const handler = () => void atualizar()
    window.addEventListener("santa-luzia:diagnostico-updated", handler)
    const timer = window.setInterval(handler, 5000)
    return () => {
      window.removeEventListener("santa-luzia:diagnostico-updated", handler)
      window.clearInterval(timer)
    }
  }, [atualizar])

  async function executarAuditoria() {
    const api = auditor()
    if (!api || executando) return
    setExecutando(true)
    setMensagem("")
    try {
      const result = await api.runSelfAudit()
      setSnapshot(result)
      setMensagem("Auditoria concluída. O relatório foi atualizado com os testes desta execução.")
    } catch {
      setMensagem("A auditoria encontrou uma falha ao executar algum teste. O erro também foi registrado no relatório.")
    } finally {
      setExecutando(false)
    }
  }

  async function exportar() {
    const api = auditor()
    if (!api || exportando) return
    setExportando(true)
    setMensagem("")
    try {
      await api.exportReport()
      setMensagem("Arquivo técnico gerado. Você pode anexá-lo no ChatGPT para análise e correção.")
      await atualizar()
    } finally {
      setExportando(false)
    }
  }

  function limpar() {
    const api = auditor()
    if (!api) return
    if (!window.confirm("Limpar o histórico técnico salvo neste aparelho?")) return
    api.clear()
    setSnapshot(null)
    setMensagem("Histórico técnico limpo.")
    void atualizar()
  }

  const eventosRecentes = useMemo(() => [...(snapshot?.events ?? [])].reverse().slice(0, 40), [snapshot])
  const cacheEntries = snapshot?.storage?.caches?.reduce((total, item) => total + Number(item.entries || 0), 0) ?? 0
  const rede = snapshot?.network?.native?.connected ?? snapshot?.network?.physical !== "offline"

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(145deg,#fffaf3,#fff)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a731d]">Beta 12 · diagnóstico interno</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl font-semibold text-primary"><Wrench className="size-5" /> Auditor Santa Luzia</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">Registra erros JavaScript, falhas e lentidão de requisições, transições demoradas, quedas de FPS, saltos de rolagem, ícones ausentes e falhas de leitura offline. O arquivo exportado não inclui senha, cookie de sessão, token ou corpo das requisições.</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${rede ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}><Wifi className="size-3.5" />{rede ? "Rede disponível" : "Sem internet"}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Indicador label="Erros" value={snapshot?.summary.errors ?? 0} danger={(snapshot?.summary.errors ?? 0) > 0} />
          <Indicador label="Alertas" value={snapshot?.summary.warnings ?? 0} warning={(snapshot?.summary.warnings ?? 0) > 0} />
          <Indicador label="Requisições lentas" value={snapshot?.summary.slowRequests ?? 0} warning={(snapshot?.summary.slowRequests ?? 0) > 0} />
          <Indicador label="Quedas de FPS" value={snapshot?.summary.lowFpsSamples ?? 0} warning={(snapshot?.summary.lowFpsSamples ?? 0) > 0} />
          <Indicador label="Saltos de rolagem" value={snapshot?.summary.scrollJumps ?? 0} warning={(snapshot?.summary.scrollJumps ?? 0) > 0} />
          <Indicador label="Ícones ausentes" value={snapshot?.summary.missingIconAudits ?? 0} warning={(snapshot?.summary.missingIconAudits ?? 0) > 0} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void executarAuditoria()} disabled={executando} className="gap-2"><RefreshCw className={`size-4 ${executando ? "animate-spin" : ""}`} />{executando ? "Auditando…" : "Executar auditoria agora"}</Button>
          <Button type="button" variant="outline" onClick={() => void exportar()} disabled={exportando} className="gap-2"><Download className="size-4" />{exportando ? "Gerando…" : "Gerar relatório técnico"}</Button>
          <Button type="button" variant="outline" onClick={limpar} className="gap-2 text-destructive"><Trash2 className="size-4" />Limpar histórico</Button>
        </div>
        {mensagem && <p className="mt-3 rounded-xl border bg-white px-3 py-2 text-xs text-muted-foreground">{mensagem}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={<ShieldCheck className="size-4" />} title="Versão monitorada" value={snapshot?.app.version ?? "2.0.0-beta.12"} />
        <InfoCard icon={<Gauge className="size-4" />} title="Dados locais aproximados" value={`${formatBytes(snapshot?.storage.localStorageApproxBytes ?? 0)} · ${cacheEntries} itens em cache`} />
        <InfoCard icon={<Activity className="size-4" />} title="Tela atual" value={snapshot?.app.route ?? (typeof location !== "undefined" ? location.pathname : "—")} />
      </div>

      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-serif text-xl font-semibold text-primary">Eventos recentes</h3><p className="text-[10px] text-muted-foreground">Os 40 registros técnicos mais recentes deste aparelho.</p></div>
          {snapshot && snapshot.summary.errors === 0 && snapshot.summary.warnings === 0 ? <CheckCircle2 className="size-6 text-emerald-600" /> : <AlertTriangle className="size-6 text-amber-600" />}
        </div>
        <div className="mt-3 space-y-2">
          {eventosRecentes.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Nenhum evento técnico registrado ainda.</p> : eventosRecentes.map((evento) => (
            <article key={evento.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground">{resumoEvento(evento)}</p><p className="mt-1 truncate text-[9px] text-muted-foreground">{new Date(evento.at).toLocaleString("pt-BR")} · {evento.route || "sem rota"}</p></div><Nivel value={evento.level} /></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Indicador({ label, value, danger = false, warning = false }: { label: string; value: number; danger?: boolean; warning?: boolean }) {
  const classes = danger ? "border-red-200 bg-red-50" : warning ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
  const valueClass = danger ? "text-red-700" : warning ? "text-amber-800" : "text-emerald-700"
  return <div className={`rounded-2xl border p-3 ${classes}`}><b className={`block text-xl ${valueClass}`}>{value}</b><span className="mt-1 block text-[9px] font-bold uppercase leading-4 text-muted-foreground">{label}</span></div>
}

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border bg-card p-3"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-primary">{icon}{title}</p><p className="mt-2 break-words text-xs text-muted-foreground">{value}</p></div>
}
