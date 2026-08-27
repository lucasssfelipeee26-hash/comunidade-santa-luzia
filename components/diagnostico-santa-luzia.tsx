"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, RefreshCw, ScanSearch, Send, ShieldCheck, Trash2, Wifi, WifiOff, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"

type EventoDiagnostico = { id: string; at: number; type: string; level: "info" | "warning" | "error"; [key: string]: unknown }
type SnapshotDiagnostico = {
  network: { physical: string; native?: { connected?: boolean; connectionType?: string } }
  database?: { ok?: boolean }
  queue?: { pending?: number; blocked?: number }
  summary: { errors: number; warnings: number; slowRequests: number; lowFpsSamples: number; scrollJumps: number; missingIconAudits: number; blockedMutations?: number; deepFindings?: number; deepErrors?: number; deepWarnings?: number; countingMode?: string }
  events: EventoDiagnostico[]
  export?: { ok?: boolean; fileName?: string; location?: string; uri?: string; method?: string }
}
type AuditorApi = {
  version: string
  snapshot(): Promise<SnapshotDiagnostico>
  runSelfAudit(): Promise<SnapshotDiagnostico>
  exportReport(): Promise<SnapshotDiagnostico>
  shareLastReport?(): Promise<unknown>
  clear(): void
  add?(type: string, level: "info" | "warning" | "error", detail?: Record<string, unknown>): unknown
}
type DeepResult = {
  version: string
  summary: { findings: number; errors: number; warnings: number; checkedIcons: number; checkedInteractive: number; checkedImages: number; durationMs: number }
  findings: Array<Record<string, unknown>>
  glitchTip?: { configured?: boolean; connected?: boolean; sent?: boolean; reason?: string; lastError?: string | null }
}
type DeepApi = { version: string; run(options?: { sendRemote?: boolean }): Promise<DeepResult>; getLast(): DeepResult | null; getGlitchTipStatus?(): Record<string, unknown> }

function auditor(): AuditorApi | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { SantaLuziaAuditor?: AuditorApi }).SantaLuziaAuditor ?? null
}
function deepAuditor(): DeepApi | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { SantaLuziaDeepAudit?: DeepApi }).SantaLuziaDeepAudit ?? null
}
function ensureScript(src: string, marker: string, onload?: () => void) {
  if (document.querySelector(`script[data-${marker}]`)) return
  const script = document.createElement("script")
  script.src = src
  script.defer = true
  script.setAttribute(`data-${marker}`, "true")
  if (onload) script.onload = onload
  document.head.appendChild(script)
}

export function DiagnosticoSantaLuzia() {
  const [snapshot, setSnapshot] = useState<SnapshotDiagnostico | null>(null)
  const [deep, setDeep] = useState<DeepResult | null>(null)
  const [executando, setExecutando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [auditorPronto, setAuditorPronto] = useState(false)
  const [deepPronto, setDeepPronto] = useState(false)
  const [ultimoArquivo, setUltimoArquivo] = useState<string | null>(null)

  const atualizar = useCallback(async () => {
    const api = auditor()
    setAuditorPronto(Boolean(api))
    setDeepPronto(Boolean(deepAuditor()))
    if (!api) return
    try {
      setSnapshot(await api.snapshot())
      setDeep(deepAuditor()?.getLast() ?? null)
    } catch (error) {
      setMensagem(error instanceof Error ? `Falha ao ler o Auditor: ${error.message}` : "Falha ao ler o Auditor Santa Luzia.")
    }
  }, [])

  useEffect(() => {
    ensureScript("/motion/android-deep-auditor-beta16.js", "santa-luzia-deep-audit", () => setDeepPronto(Boolean(deepAuditor())))
    ensureScript("/motion/android-auditor-patch-beta16.js", "santa-luzia-auditor-patch")
    let tentativas = 0
    const boot = window.setInterval(() => {
      tentativas += 1
      if (auditor()) {
        window.clearInterval(boot)
        void atualizar()
      } else if (tentativas > 30) {
        window.clearInterval(boot)
        setAuditorPronto(false)
      }
    }, 250)
    return () => window.clearInterval(boot)
  }, [atualizar])

  async function rodarDeepScan(sendRemote = true) {
    const api = deepAuditor()
    if (!api) return null
    const result = await api.run({ sendRemote })
    setDeep(result)
    const core = auditor()
    const level: "info" | "warning" | "error" = result.summary.errors > 0 ? "error" : result.summary.warnings > 0 ? "warning" : "info"
    core?.add?.("deep-ui-audit", level, {
      engine: "Santa Luzia Deep Scan + GlitchTip bridge",
      summary: result.summary,
      findings: result.findings.slice(0, 100),
      glitchTip: result.glitchTip ?? null,
    })
    return result
  }

  async function executarAuditoria() {
    const api = auditor()
    if (!api || executando) return
    setExecutando(true)
    setMensagem("Executando Auditor + varredura profunda da interface…")
    try {
      await api.runSelfAudit()
      const deepResult = await rodarDeepScan(true)
      setSnapshot(await api.snapshot())
      const count = deepResult?.summary.findings ?? 0
      setMensagem(count > 0 ? `Auditoria concluída. A varredura profunda encontrou ${count} ponto(s) para o relatório técnico.` : "Auditoria concluída. A varredura profunda não encontrou inconsistências visuais nesta tela.")
    } catch (error) {
      setMensagem(error instanceof Error ? `A auditoria registrou uma falha: ${error.message}` : "A auditoria registrou uma falha interna.")
      await atualizar()
    } finally { setExecutando(false) }
  }

  async function exportar() {
    const api = auditor()
    if (!api || exportando) return
    setExportando(true)
    setMensagem("Gerando o relatório completo…")
    try {
      await rodarDeepScan(true)
      const result = await api.exportReport()
      setSnapshot(result)
      const exp = result.export
      setUltimoArquivo(exp?.fileName || null)
      setMensagem(`Relatório gerado com sucesso: ${exp?.location || exp?.fileName || "Downloads"}.`)
    } catch (error) {
      setMensagem(error instanceof Error ? `Não foi possível gerar o relatório: ${error.message}` : "Não foi possível gerar o relatório técnico.")
    } finally { setExportando(false) }
  }

  async function compartilhar() {
    const api = auditor()
    if (!api?.shareLastReport || compartilhando) return
    setCompartilhando(true)
    try {
      await api.shareLastReport()
      setMensagem("Compartilhamento aberto. Escolha onde enviar o relatório.")
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível compartilhar o relatório.")
    } finally { setCompartilhando(false) }
  }

  function limpar() {
    const api = auditor()
    if (!api || !window.confirm("Limpar o histórico técnico e remover o último arquivo de relatório gerado?")) return
    api.clear()
    setSnapshot(null)
    setDeep(null)
    setUltimoArquivo(null)
    setMensagem("Histórico e último relatório removidos.")
  }

  const rede = snapshot?.network?.native?.connected ?? snapshot?.network?.physical !== "offline"
  const bancoOk = snapshot?.database?.ok !== false
  const filaPendente = Number(snapshot?.queue?.pending || 0)
  const deepFindings = deep?.summary.findings ?? snapshot?.summary.deepFindings ?? 0
  const glitchTipConfigured = Boolean(deep?.glitchTip?.configured)

  return (
    <section data-auditor-santa-luzia="beta17" data-deep-auditor-ui="true">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(145deg,#fffaf3,#fff)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a731d]">Beta 17 · Auditor + Deep Scan</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl font-semibold text-primary"><Wrench className="size-5" /> Auditor Santa Luzia</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">Auditoria online/offline com contagem por defeitos únicos. Repetições do mesmo problema ficam registradas no relatório sem aumentar artificialmente o total.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Status ok={rede} icon={rede ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />} label={rede ? "Rede disponível" : "Modo offline"} />
            <Status ok={auditorPronto} icon={<ShieldCheck className="size-3.5" />} label={auditorPronto ? "Auditor ativo" : "Auditor indisponível"} />
            <Status ok={deepPronto} icon={<ScanSearch className="size-3.5" />} label={deepPronto ? `Deep Scan ativo${glitchTipConfigured ? " + GlitchTip" : " · GlitchTip preparado"}` : "Deep Scan carregando"} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          <Indicador label="Erros" value={snapshot?.summary.errors ?? 0} danger={(snapshot?.summary.errors ?? 0) > 0} />
          <Indicador label="Alertas" value={snapshot?.summary.warnings ?? 0} warning={(snapshot?.summary.warnings ?? 0) > 0} />
          <Indicador label="Req. lentas" value={snapshot?.summary.slowRequests ?? 0} warning={(snapshot?.summary.slowRequests ?? 0) > 0} />
          <Indicador label="Quedas FPS" value={snapshot?.summary.lowFpsSamples ?? 0} warning={(snapshot?.summary.lowFpsSamples ?? 0) > 0} />
          <Indicador label="Saltos" value={snapshot?.summary.scrollJumps ?? 0} warning={(snapshot?.summary.scrollJumps ?? 0) > 0} />
          <Indicador label="Ícones" value={snapshot?.summary.missingIconAudits ?? 0} warning={(snapshot?.summary.missingIconAudits ?? 0) > 0} />
          <Indicador label="Interface" value={deepFindings} warning={deepFindings > 0} />
          <Indicador label="Fila" value={filaPendente} warning={filaPendente > 0} />
          <Indicador label="Banco" value={bancoOk ? 1 : 0} danger={!bancoOk} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void executarAuditoria()} disabled={executando || !auditorPronto} className="gap-2"><RefreshCw className={`size-4 ${executando ? "animate-spin" : ""}`} />{executando ? "Auditando…" : "Executar auditoria"}</Button>
          <Button type="button" variant="outline" onClick={() => void exportar()} disabled={exportando || !auditorPronto} className="gap-2"><Download className="size-4" />{exportando ? "Gerando…" : "Gerar relatório"}</Button>
          {ultimoArquivo && <Button type="button" variant="outline" onClick={() => void compartilhar()} disabled={compartilhando} className="gap-2"><Send className="size-4" />{compartilhando ? "Abrindo…" : "Compartilhar"}</Button>}
          <Button type="button" variant="outline" onClick={limpar} disabled={!auditorPronto} className="gap-2 text-destructive"><Trash2 className="size-4" />Limpar histórico</Button>
        </div>
        {mensagem && <p role="status" className="mt-3 rounded-xl border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">{mensagem}</p>}
      </div>
    </section>
  )
}

function Status({ ok, icon, label }: { ok: boolean; icon: React.ReactNode; label: string }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{icon}{label}</span>
}
function Indicador({ label, value, danger = false, warning = false }: { label: string; value: number; danger?: boolean; warning?: boolean }) {
  const classes = danger ? "border-red-200 bg-red-50" : warning ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
  const valueClass = danger ? "text-red-700" : warning ? "text-amber-800" : "text-emerald-700"
  return <div className={`rounded-2xl border p-2.5 ${classes}`}><b className={`block text-lg ${valueClass}`}>{value}</b><span className="mt-1 block text-[8px] font-bold uppercase leading-3 text-muted-foreground">{label}</span></div>
}
