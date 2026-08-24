"use client"

import { useEffect, useState } from "react"
import { CloudOff, FileText, Loader2 } from "lucide-react"

type StatusRegistro = "presente" | "falta" | "justificada" | "advertencia" | "atraso" | "observacao"

type Registro = {
  id: string
  usuarioNome: string
  formacaoTitulo: string
  formacaoData: string
  formacaoHorario?: string | null
  status: StatusRegistro
  justificativa?: string | null
}

type Resposta = {
  escopo?: "me" | "equipe"
  recentes?: Registro[]
}

const nomes: Record<StatusRegistro, string> = {
  presente: "Presença",
  falta: "Falta",
  justificada: "Justificativa",
  advertencia: "Advertência",
  atraso: "Atraso",
  observacao: "Observação",
}

const tipos: StatusRegistro[] = ["presente", "falta", "justificada", "advertencia", "atraso", "observacao"]

function dataBr(value: string) {
  const [ano, mes, dia] = value.split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : value
}

function motionAtiva() {
  const ua = navigator.userAgent
  return ua.includes("SantaLuziaMotionBeta/") || ua.includes("SantaLuziaOriginalUIOffline/") || ua.includes("SantaLuziaWindowsBeta/")
}

function fisicamenteOffline() {
  return document.documentElement.dataset.physicalNetwork === "offline"
}

export function MeuRelatorioWindows() {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(false)
  const [offline, setOffline] = useState(false)

  async function carregar() {
    try {
      const response = await fetch("/api/formacoes/presencas/resumo?escopo=me", {
        cache: "no-store",
        credentials: "same-origin",
      })
      const json = response.ok ? await response.json() as Resposta : null
      if (json?.escopo === "me" && Array.isArray(json.recentes)) setRegistros(json.recentes)
      else if (registros === null) setRegistros([])
    } catch {
      if (registros === null) setRegistros([])
    } finally {
      setOffline(fisicamenteOffline())
    }
  }

  useEffect(() => {
    const habilitado = motionAtiva()
    setAtivo(habilitado)
    if (!habilitado) return
    void carregar()
    const atualizar = () => void carregar()
    window.addEventListener("santa-luzia:server-sync", atualizar)
    window.addEventListener("santa-luzia:offline-data", atualizar)
    window.addEventListener("online", atualizar)
    window.addEventListener("offline", atualizar)
    return () => {
      window.removeEventListener("santa-luzia:server-sync", atualizar)
      window.removeEventListener("santa-luzia:offline-data", atualizar)
      window.removeEventListener("online", atualizar)
      window.removeEventListener("offline", atualizar)
    }
  }, [])

  if (!ativo) return null

  return (
    <section data-motion-personal-report="true" className="mb-3 rounded-2xl border border-primary/15 bg-[linear-gradient(145deg,#fffaf3,#fff)] p-3 shadow-sm">
      <button type="button" onClick={() => setAberto((valor) => !valor)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-serif text-base font-semibold text-primary"><FileText className="size-4 shrink-0" /> Meu relatório</span>
          <span className="mt-0.5 block truncate text-[9px] text-muted-foreground">Seu histórico pessoal de presença, faltas, justificativas, advertências e atrasos.</span>
        </span>
        <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white">{aberto ? "Fechar" : "Consultar"}</span>
      </button>

      {aberto && (
        <div className="mt-3 border-t border-primary/10 pt-3">
          {offline && <p className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-950"><CloudOff className="size-3.5 shrink-0" />Mostrando o histórico já salvo neste aparelho. Novos dados chegam quando a internet voltar.</p>}
          {registros === null ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando seus registros…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {tipos.map((tipo) => (
                  <div key={tipo} className="rounded-xl border bg-white p-2 text-center">
                    <b className="block text-lg text-primary">{registros.filter((registro) => registro.status === tipo).length}</b>
                    <span className="text-[8px] font-bold uppercase text-muted-foreground">{nomes[tipo]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {registros.map((registro) => (
                  <article key={registro.id} className="rounded-xl border bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="min-w-0 text-xs">{registro.formacaoTitulo}</strong>
                      <span className="shrink-0 rounded-full bg-primary/8 px-2 py-1 text-[9px] font-bold text-primary">{nomes[registro.status]}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{dataBr(registro.formacaoData)}{registro.formacaoHorario ? ` às ${registro.formacaoHorario}` : ""}</p>
                    {registro.justificativa && <p className="mt-2 rounded-lg bg-[#fff8e8] p-2 text-[10px] text-[#6f541a]">{registro.justificativa}</p>}
                  </article>
                ))}
                {registros.length === 0 && <p className="rounded-xl border border-dashed bg-white p-4 text-xs text-muted-foreground">Nenhum registro encontrado no seu histórico pessoal.</p>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
