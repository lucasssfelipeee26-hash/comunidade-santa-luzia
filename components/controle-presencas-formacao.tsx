"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
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
  formacaoHorario?: string | null
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
  const [relatorioAberto, setRelatorioAberto] = useState(false)

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
  const historicoBase = dados.recentes.filter((registro) => {
    const combinaTexto = !termo || `${registro.usuarioNome} ${registro.usuarioFuncao} ${registro.formacaoTitulo} ${registro.justificativa || ""}`.toLocaleLowerCase("pt-BR").includes(termo)
    return combinaTexto && (!data || registro.formacaoData === data) && (situacao === "todas" || registro.status === situacao)
  })
  const historicoFiltrado = windowsBeta && !termo ? [] : historicoBase
  const tiposRelatorio: Array<{ id: Registro["status"]; rotulo: string }> = [
    { id: "presente", rotulo: "Presenças" },
    { id: "falta", rotulo: "Faltas" },
    { id: "justificada", rotulo: "Justificativas" },
    { id: "advertencia", rotulo: "Advertências" },
    { id: "atraso", rotulo: "Atrasos" },
    { id: "observacao", rotulo: "Observações" },
  ]
  const relatorioPorPessoa = historicoBase.reduce<Array<{ nome: string; funcao: string; registros: Registro[] }>>((grupos, registro) => {
    let grupo = grupos.find((item) => item.nome === registro.usuarioNome)
    if (!grupo) {
      grupo = { nome: registro.usuarioNome, funcao: registro.usuarioFuncao, registros: [] }
      grupos.push(grupo)
    }
    grupo.registros.push(registro)
    return grupos
  }, [])

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
          {windowsBeta && <div className="grid gap-2 rounded-2xl border bg-[#fffaf7] p-3 sm:grid-cols-[1fr_auto_auto_auto]"><label className="flex items-center gap-2 rounded-xl border bg-white px-3"><Search className="size-4 text-muted-foreground" /><input value={busca} onChange={(event) => setBusca(event.target.value)} className="min-h-10 w-full bg-transparent text-sm outline-none" placeholder="Nome ou tipo de registro" /></label><input type="date" aria-label="Filtrar por data" value={data} onChange={(event) => setData(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm" /><select aria-label="Filtrar por situação" value={situacao} onChange={(event) => setSituacao(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm"><option value="todas">Todos os registros</option><option value="presente">Presenças</option><option value="falta">Faltas</option><option value="justificada">Justificativas</option><option value="advertencia">Advertências</option><option value="atraso">Atrasos</option><option value="observacao">Observações</option></select><button type="button" onClick={() => setRelatorioAberto((valor) => !valor)} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-white">{relatorioAberto ? "Fechar relatório" : "Ver relatório"}</button></div>}
          {windowsBeta && relatorioAberto && <section className="rounded-3xl border border-primary/15 bg-[linear-gradient(145deg,#fffaf3,#fff)] p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a731d]">Relatório Santa Luzia</p><h2 className="mt-1 font-serif text-xl text-primary">Acompanhamento por pessoa</h2><p className="mt-1 text-xs text-muted-foreground">{termo ? `Pesquisa: ${busca}` : "Relatório completo da equipe"}{data ? ` · ${formatarData(data)}` : ""}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{historicoBase.length} registros</span></div><div className="mt-4 space-y-3">{relatorioPorPessoa.map((grupo) => <article key={`relatorio-${grupo.nome}`} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-serif text-lg font-semibold text-primary">{grupo.nome}</h3><p className="text-xs text-muted-foreground">{grupo.funcao}</p></div><span className="rounded-full bg-[#f5efeb] px-2.5 py-1 text-[10px] font-bold text-[#655d5f]">{grupo.registros.length} registros</span></div><dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-y py-3 sm:grid-cols-6">{tiposRelatorio.map((tipo) => <div key={tipo.id} className="min-w-0 text-center"><dd className="font-serif text-xl font-semibold text-primary">{grupo.registros.filter((registro) => registro.status === tipo.id).length}</dd><dt className="truncate text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{tipo.rotulo}</dt></div>)}</dl><details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-primary">Ver datas e detalhes</summary><div className="mt-2 space-y-2">{grupo.registros.map((registro) => <div key={registro.id} className="rounded-xl bg-[#fffaf7] p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{registro.formacaoTitulo} · {formatarData(registro.formacaoData)}{registro.formacaoHorario ? ` às ${registro.formacaoHorario}` : ""}</p><Situacao status={registro.status} /></div>{registro.justificativa && <p className="mt-1.5 text-xs leading-5 text-[#6f541a]">{registro.justificativa}</p>}</div>)}</div></details></article>)}{relatorioPorPessoa.length === 0 && <p className="rounded-2xl border border-dashed bg-white p-5 text-sm text-muted-foreground">Nenhum registro encontrado para os filtros escolhidos.</p>}</div></section>}
          {!relatorioAberto && historicoFiltrado.map((registro) => (
            <article key={registro.id} className="rounded-2xl border border-[#e1d7d1] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#2b2224]">{registro.usuarioNome}</h2>
                  <p className="text-xs text-[#756d6f]">{registro.usuarioFuncao}{registro.usuarioTipo === "moderador" ? " · Moderador" : ""}</p>
                  <p className="mt-2 text-sm text-[#4f4749]">{registro.formacaoTitulo} · {formatarData(registro.formacaoData)}{registro.formacaoHorario ? ` às ${registro.formacaoHorario}` : ""}</p>
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
          {historicoFiltrado.length === 0 && !relatorioAberto && <p className="rounded-2xl border border-dashed bg-white p-5 text-muted-foreground">{windowsBeta && !termo ? "Pesquise um nome para consultar o histórico individual ou abra o relatório completo." : "Nenhum registro encontrado para os filtros escolhidos."}</p>}
        </section>
      )}
    </div>
  )
}
