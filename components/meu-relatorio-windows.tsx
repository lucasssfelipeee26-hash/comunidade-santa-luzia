"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"

type Registro = {
  id: string
  usuarioNome: string
  formacaoTitulo: string
  formacaoData: string
  formacaoHorario?: string | null
  status: "presente" | "falta" | "justificada" | "advertencia" | "atraso" | "observacao"
  justificativa?: string | null
}

const nomes = { presente: "Presença", falta: "Falta", justificada: "Justificativa", advertencia: "Advertência", atraso: "Atraso", observacao: "Observação" }

function dataBr(value: string) { const [ano, mes, dia] = value.split("-"); return ano && mes && dia ? `${dia}/${mes}/${ano}` : value }

export function MeuRelatorioWindows() {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [aberto, setAberto] = useState(false)
  const [windows, setWindows] = useState(false)

  useEffect(() => {
    const ativo = navigator.userAgent.includes("SantaLuziaWindowsBeta/")
    setWindows(ativo)
    if (!ativo) return
    void fetch("/api/formacoes/presencas/resumo", { cache: "no-store", credentials: "same-origin", headers: { "X-Santa-Luzia-Windows-Beta": "1" } })
      .then(async (response) => response.ok ? response.json() : null)
      .then((json) => setRegistros(Array.isArray(json?.recentes) ? json.recentes : []))
      .catch(() => setRegistros([]))
  }, [])

  if (!windows) return null
  return <section data-windows-beta-personal-report="true" className="mb-3 rounded-2xl border border-primary/15 bg-[linear-gradient(145deg,#fffaf3,#fff)] p-3 shadow-sm">
    <button type="button" onClick={() => setAberto((valor) => !valor)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left"><span className="flex items-center gap-2 font-serif text-base font-semibold text-primary"><FileText className="size-4" /> Meu relatório</span><span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white">{aberto ? "Fechar" : "Consultar"}</span></button>
    {aberto && <div className="mt-3 border-t border-primary/10 pt-3">{registros === null ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando seus registros…</p> : <><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{(Object.keys(nomes) as Array<keyof typeof nomes>).map((tipo) => <div key={tipo} className="rounded-xl border bg-white p-2 text-center"><b className="block text-lg text-primary">{registros.filter((registro) => registro.status === tipo).length}</b><span className="text-[8px] font-bold uppercase text-muted-foreground">{nomes[tipo]}</span></div>)}</div><div className="mt-3 space-y-2">{registros.map((registro) => <article key={registro.id} className="rounded-xl border bg-white p-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs">{registro.formacaoTitulo}</strong><span className="rounded-full bg-primary/8 px-2 py-1 text-[9px] font-bold text-primary">{nomes[registro.status]}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{dataBr(registro.formacaoData)}{registro.formacaoHorario ? ` às ${registro.formacaoHorario}` : ""}</p>{registro.justificativa && <p className="mt-2 rounded-lg bg-[#fff8e8] p-2 text-[10px] text-[#6f541a]">{registro.justificativa}</p>}</article>)}{registros.length === 0 && <p className="rounded-xl border border-dashed bg-white p-4 text-xs text-muted-foreground">Nenhum registro encontrado no seu perfil.</p>}</div></>}</div>}
  </section>
}
