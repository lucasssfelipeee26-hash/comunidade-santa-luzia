"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react"

type Contagem = {
  presencas: number
  faltas: number
  justificadas: number
  total: number
}

type Pessoa = Contagem & {
  id: string
  nome: string
  funcao: string
  tipo: "moderador" | "membro"
  advertencias: number
  atrasos: number
}

type Formacao = Contagem & {
  id: string
  titulo: string
  tema: string
  data: string
  horario: string | null
  status: "agendada" | "concluida" | "cancelada"
  naoRegistrados: number
}

type Registro = {
  id: string
  usuarioNome: string
  usuarioFuncao: string
  usuarioTipo: "moderador" | "membro"
  formacaoTitulo: string
  formacaoData: string
  status: "presente" | "falta" | "justificada" | "advertencia" | "observacao" | "atraso"
  justificativa: string | null
  atualizadoEm: number
}

type Resposta = {
  resumo: Contagem & {
    naoRegistrados: number
    participantes: number
    formacoes: number
  }
  pessoas: Pessoa[]
  formacoes: Formacao[]
  recentes: Registro[]
}

type Aba = "pessoas" | "formacoes" | "historico"

function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

function Situacao({ status }: { status: Registro["status"] }) {
  const dados = status === "presente"
    ? { texto: "Presente", classe: "bg-emerald-100 text-emerald-800", icone: <CheckCircle2 className="size-4" /> }
    : status === "justificada"
      ? { texto: "Justificada", classe: "bg-amber-100 text-amber-900", icone: <ShieldCheck className="size-4" /> }
      : status === "advertencia"
        ? { texto: "Advertência", classe: "bg-rose-100 text-rose-900", icone: <AlertCircle className="size-4" /> }
        : status === "atraso"
          ? { texto: "Atraso", classe: "bg-orange-100 text-orange-900", icone: <Clock3 className="size-4" /> }
        : status === "observacao"
          ? { texto: "Observação", classe: "bg-slate-100 text-slate-800", icone: <History className="size-4" /> }
          : { texto: "Falta", classe: "bg-red-100 text-red-800", icone: <XCircle className="size-4" /> }

  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${dados.classe}`}>{dados.icone}{dados.texto}</span>
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-2xl border border-[#e1d7d1] bg-white p-4 shadow-sm">
      <dt className="text-xs font-bold uppercase tracking-[.08em] text-[#756d6f]">{rotulo}</dt>
      <dd className={`mt-1 font-serif text-3xl font-semibold ${cor}`}>{valor}</dd>
    </div>
  )
}

export function ControlePresencasFormacao() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<Aba>("pessoas")
  const [windowsBeta, setWindowsBeta] = useState(false)
  const [busca, setBusca] = useState("")
  const [situacao, setSituacao] = useState("todas")
  const [data, setData] = useState("")

  async function carregar() {
    setCarregando(true)
    try {
      const response = await fetch("/api/formacoes/presencas/resumo", {
        cache: "no-store",
        credentials: "same-origin",
        headers: navigator.userAgent.includes("SantaLuziaWindowsBeta/") ? { "X-Santa-Luzia-Windows-Beta": "1" } : {},
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.resumo) {
        throw new Error(json?.erro || "Não foi possível carregar o controle de presença.")
      }
      setDados(json)
      setErro("")
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o controle de presença.")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    setWindowsBeta(navigator.userAgent.includes("SantaLuziaWindowsBeta/"))
    void carregar()
    const sincronizar = () => void carregar()
    window.addEventListener("santa-luzia:server-sync", sincronizar)
    return () => window.removeEventListener("santa-luzia:server-sync", sincronizar)
  }, [])

  if (carregando && !dados) {
    return <p className="flex items-center gap-2 rounded-2xl border bg-white p-5 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando controle de presença...</p>
  }

  if (erro && !dados) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        <p className="flex items-center gap-2"><AlertCircle className="size-5" /> {erro}</p>
        <button type="button" onClick={carregar} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-bold">
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!dados) return null

  const termo = busca.trim().toLocaleLowerCase("pt-BR")
  const pessoasFiltradas = dados.pessoas.filter((pessoa) => (!windowsBeta || Boolean(termo)) && (!termo || `${pessoa.nome} ${pessoa.funcao}`.toLocaleLowerCase("pt-BR").includes(termo)))
  const historicoFiltrado = dados.recentes.filter((registro) => {
    const combinaTexto = !termo || `${registro.usuarioNome} ${registro.usuarioFuncao} ${registro.formacaoTitulo} ${registro.justificativa || ""}`.toLocaleLowerCase("pt-BR").includes(termo)
    return combinaTexto && (!data || registro.formacaoData === data) && (situacao === "todas" || registro.status === situacao)
  })
  function exportarRelatorio() {
    const linhas = [["Nome", "Função", "Registro", "Data", "Descrição"], ...historicoFiltrado.map((registro) => [registro.usuarioNome, registro.usuarioFuncao, registro.status, formatarData(registro.formacaoData), registro.justificativa || registro.formacaoTitulo])]
    const csv = linhas.map((linha) => linha.map((valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `relatorio-presencas-${data || "completo"}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5" data-windows-beta-presence-center={windowsBeta ? "true" : undefined}>
      {!windowsBeta && <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Presenças" valor={dados.resumo.presencas} cor="text-emerald-700" />
        <Numero rotulo="Faltas" valor={dados.resumo.faltas} cor="text-red-700" />
        <Numero rotulo="Justificadas" valor={dados.resumo.justificadas} cor="text-amber-700" />
        <Numero rotulo="Não marcadas" valor={dados.resumo.naoRegistrados} cor="text-slate-700" />
      </dl>}

      <div className={`grid ${windowsBeta ? "grid-cols-2" : "grid-cols-3"} gap-2 rounded-2xl border border-[#e1d7d1] bg-[#fffaf7] p-2`} role="tablist" aria-label="Controle de presença">
        {([
          ["pessoas", "Equipe", Users],
          ["formacoes", "Formações", CalendarDays],
          ["historico", "Histórico", History],
        ] as const).filter(([id]) => !windowsBeta || id !== "formacoes").map(([id, rotulo, Icone]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition sm:flex-row ${aba === id ? "bg-[#8f1934] text-white shadow-sm" : "bg-white text-[#5f5658]"}`}
          >
            <Icone className="size-4" /> {rotulo}
          </button>
        ))}
      </div>

      {aba === "pessoas" && (
        <section role="tabpanel">
          {windowsBeta && <label className="mb-3 flex items-center gap-2 rounded-2xl border bg-white px-3"><Search className="size-4 text-muted-foreground" /><input value={busca} onChange={(event) => setBusca(event.target.value)} className="min-h-11 w-full bg-transparent text-sm outline-none" placeholder="Pesquisar acólito ou coroinha" /></label>}
          <div className="grid gap-3 md:grid-cols-2">
          {pessoasFiltradas.map((pessoa) => (
            <article key={pessoa.id} className="rounded-2xl border border-[#e1d7d1] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-[#2b2224]">{pessoa.nome}</h2>
                  <p className="text-xs text-[#756d6f]">{pessoa.funcao}{pessoa.tipo === "moderador" ? " · Moderador" : ""}</p>
                </div>
                <span className="rounded-full bg-[#f5efeb] px-2.5 py-1 text-xs font-bold text-[#655d5f]">{pessoa.total} registros</span>
              </div>
              <dl className={`mt-4 grid ${windowsBeta ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"} gap-2 text-center`}>
                <div className="rounded-xl bg-emerald-50 p-2"><dt className="text-[10px] font-bold uppercase text-emerald-800">Presenças</dt><dd className="text-xl font-bold text-emerald-800">{pessoa.presencas}</dd></div>
                <div className="rounded-xl bg-red-50 p-2"><dt className="text-[10px] font-bold uppercase text-red-800">Faltas</dt><dd className="text-xl font-bold text-red-800">{pessoa.faltas}</dd></div>
                <div className="rounded-xl bg-amber-50 p-2"><dt className="text-[10px] font-bold uppercase text-amber-900">Justif.</dt><dd className="text-xl font-bold text-amber-900">{pessoa.justificadas}</dd></div>
                {windowsBeta && <div className="rounded-xl bg-rose-50 p-2"><dt className="text-[10px] font-bold uppercase text-rose-900">Advert.</dt><dd className="text-xl font-bold text-rose-900">{pessoa.advertencias}</dd></div>}
                {windowsBeta && <div className="rounded-xl bg-orange-50 p-2"><dt className="text-[10px] font-bold uppercase text-orange-900">Atrasos</dt><dd className="text-xl font-bold text-orange-900">{pessoa.atrasos}</dd></div>}
              </dl>
            </article>
          ))}
          {pessoasFiltradas.length === 0 && <p className="rounded-2xl border border-dashed bg-white p-5 text-muted-foreground">{windowsBeta && !termo ? "Digite um nome para consultar o relatório individual." : "Nenhum resultado encontrado."}</p>}
          </div>
        </section>
      )}

      {aba === "formacoes" && (
        <section role="tabpanel" className="space-y-3">
          {dados.formacoes.map((formacao) => (
            <article key={formacao.id} className="rounded-2xl border border-[#e1d7d1] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.08em] text-[#9a731d]">{formatarData(formacao.data)}{formacao.horario ? ` · ${formacao.horario}` : ""}</p>
                  <h2 className="mt-1 font-serif text-xl text-[#123f2e]">{formacao.titulo}</h2>
                  <p className="text-sm text-[#6d6255]">{formacao.tema}</p>
                </div>
                {formacao.status === "cancelada" && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">Cancelada</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{formacao.presencas} presentes</span>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{formacao.faltas} faltas</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">{formacao.justificadas} justificadas</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{formacao.naoRegistrados} não marcadas</span>
              </div>
            </article>
          ))}
        </section>
      )}

      {aba === "historico" && (
        <section role="tabpanel" className="space-y-3">
          {windowsBeta && <div className="grid gap-2 rounded-2xl border bg-[#fffaf7] p-3 sm:grid-cols-[1fr_auto_auto_auto]"><label className="flex items-center gap-2 rounded-xl border bg-white px-3"><Search className="size-4 text-muted-foreground" /><input value={busca} onChange={(event) => setBusca(event.target.value)} className="min-h-10 w-full bg-transparent text-sm outline-none" placeholder="Nome ou tipo de registro" /></label><input type="date" aria-label="Filtrar por data" value={data} onChange={(event) => setData(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm" /><select aria-label="Filtrar por situação" value={situacao} onChange={(event) => setSituacao(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm"><option value="todas">Todos os registros</option><option value="presente">Presenças</option><option value="falta">Faltas</option><option value="justificada">Justificativas</option><option value="advertencia">Advertências</option><option value="atraso">Atrasos</option><option value="observacao">Observações</option></select><button type="button" onClick={exportarRelatorio} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-white"><FileDown className="size-4" /> Relatório</button></div>}
          {historicoFiltrado.map((registro) => (
            <article key={registro.id} className="rounded-2xl border border-[#e1d7d1] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#2b2224]">{registro.usuarioNome}</h2>
                  <p className="text-xs text-[#756d6f]">{registro.usuarioFuncao}{registro.usuarioTipo === "moderador" ? " · Moderador" : ""}</p>
                  <p className="mt-2 text-sm text-[#4f4749]">{registro.formacaoTitulo} · {formatarData(registro.formacaoData)}</p>
                </div>
                <Situacao status={registro.status} />
              </div>
              {registro.justificativa && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <strong>{registro.status === "justificada" ? "Justificativa" : registro.status === "advertencia" ? "Advertência" : "Detalhes"}:</strong> {registro.justificativa}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#756d6f]"><Clock3 className="size-3.5" /> Atualizado em {new Date(registro.atualizadoEm).toLocaleString("pt-BR")}</p>
            </article>
          ))}
          {historicoFiltrado.length === 0 && <p className="rounded-2xl border border-dashed bg-white p-5 text-muted-foreground">Nenhum registro encontrado para os filtros escolhidos.</p>}
        </section>
      )}
    </div>
  )
}
