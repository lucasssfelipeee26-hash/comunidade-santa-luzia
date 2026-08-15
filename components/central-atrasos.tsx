"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"

type Membro = { id: string; nome: string; funcao: string }
type Ocorrencia = {
  id: string
  usuario_id: string
  usuario_nome: string
  data_missa: string
  horario_missa: string
  limite_chegada: string
  observacao?: string | null
  status: "pendente" | "confirmado" | "rejeitado"
  criado_em: number
  reportado_por?: string | null
  reportado_por_nome?: string | null
}
type Dados = {
  eu: { id: string; nome: string; tipo: "membro" | "moderador" }
  membros: Membro[]
  ocorrencias: Ocorrencia[]
}

function hojeCuiaba() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
}

function dataBonita(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return data
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${data}T12:00:00`))
}

function statusInfo(status: Ocorrencia["status"]) {
  if (status === "confirmado") return { texto: "Confirmado", classe: "border-red-200 bg-red-50 text-red-800" }
  if (status === "rejeitado") return { texto: "Rejeitado", classe: "border-slate-200 bg-slate-50 text-slate-700" }
  return { texto: "Aguardando moderador", classe: "border-amber-200 bg-amber-50 text-amber-900" }
}

function CartaoOcorrencia({ ocorrencia, moderador, onModerar, processando }: {
  ocorrencia: Ocorrencia
  moderador: boolean
  onModerar?: (id: string, status: "confirmado" | "rejeitado") => void
  processando?: boolean
}) {
  const status = statusInfo(ocorrencia.status)
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{ocorrencia.usuario_nome}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Missa de {dataBonita(ocorrencia.data_missa)} às {ocorrencia.horario_missa}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.classe}`}>{status.texto}</span>
      </div>
      <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        <p>Horário limite: <strong className="text-foreground">{ocorrencia.limite_chegada}</strong></p>
        {ocorrencia.reportado_por_nome && <p>Reportado por: <strong className="text-foreground">{ocorrencia.reportado_por_nome}</strong></p>}
      </div>
      {ocorrencia.observacao && (
        <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-foreground">{ocorrencia.observacao}</p>
      )}
      {moderador && ocorrencia.status === "pendente" && onModerar && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={processando} onClick={() => onModerar(ocorrencia.id, "confirmado")} className="gap-2">
            <CheckCircle2 className="size-4" /> Confirmar atraso
          </Button>
          <Button disabled={processando} variant="outline" onClick={() => onModerar(ocorrencia.id, "rejeitado")} className="gap-2">
            <XCircle className="size-4" /> Rejeitar
          </Button>
        </div>
      )}
    </article>
  )
}

export function CentralAtrasos() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [alvo, setAlvo] = useState("")
  const [dataMissa, setDataMissa] = useState(hojeCuiaba())
  const [horarioMissa, setHorarioMissa] = useState("18:00")
  const [observacao, setObservacao] = useState("")
  const [erro, setErro] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [processando, setProcessando] = useState(false)

  async function carregar() {
    setErro("")
    const r = await fetch("/api/ranking", { cache: "no-store" })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.erro || "Não foi possível carregar os atrasos.")
    setDados(j)
    const candidatos = (j.membros || []).filter((m: Membro) => m.id !== j.eu?.id)
    setAlvo((atual) => atual && candidatos.some((m: Membro) => m.id === atual) ? atual : (candidatos[0]?.id || ""))
  }

  useEffect(() => {
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar."))
  }, [])

  async function reportar(e: React.FormEvent) {
    e.preventDefault()
    if (!alvo) return
    setProcessando(true)
    setErro("")
    setMensagem("")
    try {
      const r = await fetch("/api/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reportar_atraso", usuarioId: alvo, dataMissa, horarioMissa, observacao }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.erro || "Não foi possível enviar o relato.")
      setMensagem(j.mensagem || "Relato enviado ao moderador.")
      setObservacao("")
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o relato.")
    } finally {
      setProcessando(false)
    }
  }

  async function moderar(id: string, status: "confirmado" | "rejeitado") {
    setProcessando(true)
    setErro("")
    setMensagem("")
    try {
      const r = await fetch("/api/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "moderar_atraso", ocorrenciaId: id, status }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.erro || "Não foi possível moderar o relato.")
      setMensagem(status === "confirmado" ? "Atraso confirmado e liberado para contabilização no ranking." : "Relato rejeitado. Ele não será contabilizado no ranking.")
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível moderar o relato.")
    } finally {
      setProcessando(false)
    }
  }

  const isMod = dados?.eu.tipo === "moderador"
  const ocorrencias = dados?.ocorrencias || []
  const pendentes = useMemo(() => ocorrencias.filter((o) => o.status === "pendente"), [ocorrencias])
  const sobreMim = useMemo(() => dados ? ocorrencias.filter((o) => o.usuario_id === dados.eu.id) : [], [dados, ocorrencias])
  const enviadosPorMim = useMemo(() => dados ? ocorrencias.filter((o) => o.reportado_por === dados.eu.id && o.usuario_id !== dados.eu.id) : [], [dados, ocorrencias])
  const confirmados = useMemo(() => ocorrencias.filter((o) => o.status === "confirmado"), [ocorrencias])
  const candidatos = (dados?.membros || []).filter((m) => m.id !== dados?.eu.id)

  if (!dados) {
    return <div className="min-h-screen p-8 text-center text-muted-foreground">{erro || "Carregando atrasos…"}</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Central de Atrasos"
        subtitulo={isMod ? "Confirme ou rejeite os relatos da equipe" : "Reporte um colega e acompanhe os relatos"}
        voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"}
        menu={isMod ? <ModeradorMenu /> : <MembroMenu />}
      />
      <main className="mx-auto w-full max-w-5xl px-3 py-5 pb-24 sm:px-4 sm:py-8">
        <section className="mb-5 rounded-3xl border border-primary/15 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              {isMod ? <ShieldCheck className="size-5" /> : <Clock3 className="size-5" />}
            </span>
            <div>
              <h1 className="font-serif text-2xl font-semibold text-primary">Pontualidade da equipe</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Todo relato começa como pendente. O atraso só entra no histórico e no ranking depois que um moderador confirmar.
              </p>
            </div>
          </div>
        </section>

        {erro && <div className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{mensagem}</div>}

        <section className="mb-7 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold text-primary">Reportar colega atrasado</h2>
              <p className="text-sm text-muted-foreground">O colega reportado poderá ver o relato e o moderador dará a decisão final.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => void carregar()} aria-label="Atualizar">
              <RefreshCw className="size-4" />
            </Button>
          </div>
          <form onSubmit={reportar} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Colega
              <select value={alvo} onChange={(e) => setAlvo(e.target.value)} required className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
                {candidatos.map((m) => <option key={m.id} value={m.id}>{m.nome} · {m.funcao}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Data da Missa
              <input type="date" value={dataMissa} onChange={(e) => setDataMissa(e.target.value)} required className="h-11 rounded-xl border border-input bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Horário da Missa
              <input type="time" value={horarioMissa} onChange={(e) => setHorarioMissa(e.target.value)} required className="h-11 rounded-xl border border-input bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Observação (opcional)
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={300} placeholder="Ex.: chegou após o início da procissão" className="h-11 rounded-xl border border-input bg-background px-3 text-sm" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={processando || !alvo || candidatos.length === 0} className="gap-2">
                <Send className="size-4" /> {processando ? "Enviando…" : "Enviar relato ao moderador"}
              </Button>
              {candidatos.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Não há outro membro aprovado disponível para o relato.</p>}
            </div>
          </form>
        </section>

        {isMod ? (
          <>
            <section className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-primary">Aguardando sua decisão</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{pendentes.length} pendente(s)</span>
              </div>
              <div className="grid gap-3">
                {pendentes.length ? pendentes.map((o) => <CartaoOcorrencia key={o.id} ocorrencia={o} moderador onModerar={moderar} processando={processando} />) : (
                  <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhum relato aguardando confirmação.</p>
                )}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-serif text-xl font-semibold text-primary">Histórico decidido</h2>
              <div className="grid gap-3">
                {ocorrencias.filter((o) => o.status !== "pendente").map((o) => <CartaoOcorrencia key={o.id} ocorrencia={o} moderador />)}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="mb-7">
              <h2 className="mb-3 font-serif text-xl font-semibold text-primary">Relatos sobre você</h2>
              <div className="grid gap-3">
                {sobreMim.length ? sobreMim.map((o) => <CartaoOcorrencia key={o.id} ocorrencia={o} moderador={false} />) : (
                  <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Não há relatos sobre você.</p>
                )}
              </div>
            </section>
            <section className="mb-7">
              <h2 className="mb-3 font-serif text-xl font-semibold text-primary">Relatos enviados por você</h2>
              <div className="grid gap-3">
                {enviadosPorMim.length ? enviadosPorMim.map((o) => <CartaoOcorrencia key={o.id} ocorrencia={o} moderador={false} />) : (
                  <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Você ainda não enviou relatos.</p>
                )}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-serif text-xl font-semibold text-primary">Atrasos confirmados da equipe</h2>
              <div className="grid gap-3">
                {confirmados.length ? confirmados.map((o) => <CartaoOcorrencia key={o.id} ocorrencia={o} moderador={false} />) : (
                  <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhum atraso confirmado.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
