"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { AlertCircle, Check, CheckCircle2, ChevronDown, FilePenLine, Loader2, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Membro } from "@/lib/store"
import { FUNCOES_ESCALA } from "@/lib/escala-funcoes"

type Escala = {
  id: string
  data: string
  horario: string
  celebrante: string
  observacoes: string
  pessoas: Array<{ id?: string; nome: string; categoria: CategoriaEscala; funcao: string }>
  celebracao_liturgica?: string | null
  tempo_liturgico?: string | null
  cor_liturgica?: string | null
  ciclo_dominical?: string | null
  data_liturgica?: string | null
}
type EscalasResponse = { ok: boolean; escalas: Escala[]; erro?: string }
type CategoriaEscala = "acolito" | "coroinha"
type FuncaoCadastro = "Acólito" | "Coroinha"
type Rascunho = { membroId: string; funcao: string }
type PessoaEscalada = Rascunho & { categoria: CategoriaEscala }
type SeletorAberto = { tipo: "pessoa" | "funcao"; categoria: CategoriaEscala }
type LiturgiaOpcao = { liturgia: string; tempoLiturgicoAtual: string; cor: string; cicloDominical?: string; dataIso: string }

const CATEGORIAS_ESCALA: Array<{
  id: CategoriaEscala
  titulo: string
  singular: string
  funcaoCadastro: FuncaoCadastro
}> = [
  { id: "acolito", titulo: "Acólitos", singular: "acólito", funcaoCadastro: "Acólito" },
  { id: "coroinha", titulo: "Coroinhas", singular: "coroinha", funcaoCadastro: "Coroinha" },
]

function rascunhosVazios(): Record<CategoriaEscala, Rascunho> {
  return {
    acolito: { membroId: "", funcao: "" },
    coroinha: { membroId: "", funcao: "" },
  }
}

async function fetcher(url: string): Promise<EscalasResponse> {
  const response = await fetch(url, { cache: "no-store" })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json) throw new Error(json?.erro ?? "Não foi possível carregar as escalas.")
  return json
}

function hojeCuiaba() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function EditorEscala({ membros }: { membros: Membro[] }) {
  const { data, error, mutate } = useSWR<EscalasResponse>("/api/escalas", fetcher)
  const [form, setForm] = useState({ data: hojeCuiaba(), horario: "18:00", celebrante: "", observacoes: "", celebracaoLiturgica: "", tempoLiturgico: "", corLiturgica: "", cicloDominical: "", dataLiturgica: "" })
  const [rascunhos, setRascunhos] = useState<Record<CategoriaEscala, Rascunho>>(rascunhosVazios)
  const [pessoasEscaladas, setPessoasEscaladas] = useState<PessoaEscalada[]>([])
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null)
  const [seletorAberto, setSeletorAberto] = useState<SeletorAberto | null>(null)
  const [windowsBeta, setWindowsBeta] = useState(false)
  const [liturgiasDisponiveis, setLiturgiasDisponiveis] = useState<LiturgiaOpcao[]>([])
  const [carregandoLiturgia, setCarregandoLiturgia] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const ativos = useMemo(
    () => membros
      .filter((membro) => membro.status === "aprovado")
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [membros],
  )
  const membrosPorId = useMemo(() => new Map(ativos.map((membro) => [membro.id, membro])), [ativos])
  const idsEscalados = useMemo(() => new Set(pessoasEscaladas.map((pessoa) => pessoa.membroId)), [pessoasEscaladas])
  const funcoesOcupadas = useMemo(() => new Set(pessoasEscaladas.map((pessoa) => pessoa.funcao)), [pessoasEscaladas])

  const grupoDoSeletor = seletorAberto
    ? CATEGORIAS_ESCALA.find((grupo) => grupo.id === seletorAberto.categoria) ?? null
    : null
  const rascunhoDoSeletor = seletorAberto ? rascunhos[seletorAberto.categoria] : null
  const pessoasDoSeletor = grupoDoSeletor
    ? ativos.filter((membro) => membro.funcao === grupoDoSeletor.funcaoCadastro)
    : []

  useEffect(() => {
    setWindowsBeta(navigator.userAgent.includes("SantaLuziaWindowsBeta/"))
  }, [])

  useEffect(() => {
    if (!windowsBeta || !form.data) return
    let ativo = true
    setCarregandoLiturgia(true)
    const base = new Date(`${form.data}T12:00:00Z`)
    const seguinte = new Date(base); seguinte.setUTCDate(seguinte.getUTCDate() + 1)
    const dataSelecionada = base.toISOString().slice(0, 10)
    const datas = base.getUTCDay() === 6 ? [dataSelecionada, seguinte.toISOString().slice(0, 10)] : [dataSelecionada]
    void Promise.all(datas.map(async (dataIso) => {
      const response = await fetch(`/api/liturgia?data=${dataIso}`, { cache: "force-cache", headers: { "X-Santa-Luzia-Windows-Beta": "1" } })
      if (!response.ok) return null
      const json = await response.json().catch(() => null) as LiturgiaOpcao | null
      return json?.liturgia ? { ...json, dataIso } : null
    })).then((resultados) => {
      if (!ativo) return
      const unicas = resultados.filter((item): item is LiturgiaOpcao => Boolean(item)).filter((item, indice, lista) => lista.findIndex((outro) => outro.dataIso === item.dataIso && outro.liturgia === item.liturgia) === indice)
      const ordenadas = base.getUTCDay() === 6 ? [...unicas].sort((a, b) => b.dataIso.localeCompare(a.dataIso)) : unicas
      setLiturgiasDisponiveis(ordenadas)
      setForm((atual) => {
        if (atual.celebracaoLiturgica || !ordenadas[0]) return atual
        const preferida = ordenadas[0]
        return { ...atual, celebracaoLiturgica: preferida.liturgia, tempoLiturgico: preferida.tempoLiturgicoAtual || "", corLiturgica: preferida.cor || "", cicloDominical: preferida.cicloDominical || "", dataLiturgica: preferida.dataIso }
      })
    }).finally(() => { if (ativo) setCarregandoLiturgia(false) })
    return () => { ativo = false }
  }, [windowsBeta, form.data])

  useEffect(() => {
    if (!seletorAberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setSeletorAberto(null)
    }
    document.addEventListener("keydown", fecharComEscape)
    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener("keydown", fecharComEscape)
    }
  }, [seletorAberto])

  function atualizarRascunho(categoria: CategoriaEscala, valores: Partial<Rascunho>) {
    setRascunhos((atuais) => ({ ...atuais, [categoria]: { ...atuais[categoria], ...valores } }))
  }

  function escolherPessoa(categoria: CategoriaEscala, membroId: string) {
    if (idsEscalados.has(membroId)) {
      setMensagem({ tipo: "erro", texto: "Essa pessoa já foi adicionada à escala." })
      return
    }
    atualizarRascunho(categoria, { membroId })
    setMensagem(null)
    setSeletorAberto(null)
  }

  function escolherFuncao(categoria: CategoriaEscala, funcao: string) {
    if (funcao && funcoesOcupadas.has(funcao)) {
      setMensagem({ tipo: "erro", texto: "Essa função já foi atribuída a outra pessoa." })
      return
    }
    atualizarRascunho(categoria, { funcao })
    setMensagem(null)
    setSeletorAberto(null)
  }

  function adicionarPessoa(categoria: CategoriaEscala) {
    const grupo = CATEGORIAS_ESCALA.find((item) => item.id === categoria)
    const rascunho = rascunhos[categoria]
    const membro = membrosPorId.get(rascunho.membroId)

    if (!grupo || !membro || membro.funcao !== grupo.funcaoCadastro) {
      setMensagem({ tipo: "erro", texto: `Selecione um ${grupo?.singular ?? "usuário"} cadastrado.` })
      return
    }
    if (!rascunho.funcao) {
      setMensagem({ tipo: "erro", texto: "Selecione a função que essa pessoa exercerá na celebração." })
      return
    }
    if (idsEscalados.has(membro.id)) {
      setMensagem({ tipo: "erro", texto: "Essa pessoa já foi adicionada à escala." })
      return
    }
    if (funcoesOcupadas.has(rascunho.funcao)) {
      setMensagem({ tipo: "erro", texto: "Essa função já foi atribuída a outra pessoa." })
      return
    }

    setPessoasEscaladas((atuais) => [...atuais, { ...rascunho, categoria }])
    atualizarRascunho(categoria, { membroId: "", funcao: "" })
    setMensagem(null)
  }

  function removerPessoa(membroId: string) {
    setPessoasEscaladas((atuais) => atuais.filter((pessoa) => pessoa.membroId !== membroId))
    setMensagem(null)
  }

  function escolherLiturgia(chave: string) {
    const escolhida = liturgiasDisponiveis.find((item) => `${item.dataIso}::${item.liturgia}` === chave)
    if (!escolhida) return
    setForm((atual) => ({ ...atual, celebracaoLiturgica: escolhida.liturgia, tempoLiturgico: escolhida.tempoLiturgicoAtual || "", corLiturgica: escolhida.cor || "", cicloDominical: escolhida.cicloDominical || "", dataLiturgica: escolhida.dataIso }))
  }

  function iniciarEdicao(escala: Escala) {
    setEditandoId(escala.id)
    setForm({ data: escala.data, horario: escala.horario, celebrante: escala.celebrante, observacoes: escala.observacoes || "", celebracaoLiturgica: escala.celebracao_liturgica || "", tempoLiturgico: escala.tempo_liturgico || "", corLiturgica: escala.cor_liturgica || "", cicloDominical: escala.ciclo_dominical || "", dataLiturgica: escala.data_liturgica || "" })
    setPessoasEscaladas(escala.pessoas.flatMap((pessoa) => pessoa.id ? [{ membroId: pessoa.id, categoria: pessoa.categoria, funcao: pessoa.funcao }] : []))
    setRascunhos(rascunhosVazios())
    setMensagem({ tipo: "sucesso", texto: "Escala aberta para edição. Altere os dados e salve." })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setPessoasEscaladas([])
    setRascunhos(rascunhosVazios())
    setForm({ data: hojeCuiaba(), horario: "18:00", celebrante: "", observacoes: "", celebracaoLiturgica: "", tempoLiturgico: "", corLiturgica: "", cicloDominical: "", dataLiturgica: "" })
    setMensagem(null)
  }

  async function publicar() {
    if (salvando) return
    setMensagem(null)
    if (!form.data || !form.horario || !form.celebrante.trim()) {
      setMensagem({ tipo: "erro", texto: "Informe data, horário e o sacerdote celebrante." })
      return
    }
    if (windowsBeta && !form.celebracaoLiturgica) {
      setMensagem({ tipo: "erro", texto: "Selecione a celebração litúrgica indicada pelo iLiturgia." })
      return
    }
    const funcoesEscolhidas = pessoasEscaladas.map((pessoa) => pessoa.funcao)
    if (new Set(funcoesEscolhidas).size !== funcoesEscolhidas.length) {
      setMensagem({ tipo: "erro", texto: "Cada função da escala deve ser atribuída a apenas uma pessoa." })
      return
    }

    const pessoas = pessoasEscaladas.flatMap((pessoa) => {
      const membro = membrosPorId.get(pessoa.membroId)
      if (!membro) return []
      return [{ id: membro.id, nome: membro.nome, categoria: pessoa.categoria, funcao: pessoa.funcao }]
    })

    setSalvando(true)
    try {
      const response = await fetch(editandoId ? `/api/escalas/${editandoId}` : "/api/escalas", {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pessoas }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.erro ?? "Erro ao publicar a escala.")

      setPessoasEscaladas([])
      setRascunhos(rascunhosVazios())
      setForm((atual) => ({ ...atual, celebrante: "", observacoes: "", celebracaoLiturgica: "", tempoLiturgico: "", corLiturgica: "", cicloDominical: "", dataLiturgica: "" }))
      const estavaEditando = Boolean(editandoId)
      setEditandoId(null)
      await mutate()
      setMensagem({ tipo: "sucesso", texto: estavaEditando ? "Escala atualizada com sucesso." : "Escala publicada com sucesso." })
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao publicar a escala." })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta escala?")) return
    const response = await fetch(`/api/escalas/${id}`, { method: "DELETE" })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.ok) {
      setMensagem({ tipo: "erro", texto: json?.erro ?? "Não foi possível excluir a escala." })
      return
    }
    await mutate()
    setMensagem({ tipo: "sucesso", texto: "Escala excluída." })
  }

  return (
    <section className="mt-10 rounded-xl border bg-card p-5">
      <h2 className="font-serif text-2xl text-primary">{editandoId ? "Editar Escala do Dia" : "Montar Escala do Dia"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe o sacerdote celebrante e distribua as funções litúrgicas. Cada função pode ser atribuída a uma pessoa por escala.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="escala-data">Data</Label>
          <Input id="escala-data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="escala-horario">Horário</Label>
          <Input id="escala-horario" type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="escala-celebrante">Sacerdote celebrante</Label>
          <Input id="escala-celebrante" placeholder="Nome do sacerdote" value={form.celebrante} onChange={(e) => setForm({ ...form, celebrante: e.target.value })} />
        </div>
      </div>

      {windowsBeta && <div className="mt-4 rounded-2xl border border-[#d4af37]/35 bg-[#fffaf0] p-4">
        <Label htmlFor="escala-celebracao-liturgica">Celebração litúrgica</Label>
        <select id="escala-celebracao-liturgica" value={form.celebracaoLiturgica && form.dataLiturgica ? `${form.dataLiturgica}::${form.celebracaoLiturgica}` : ""} onChange={(event) => escolherLiturgia(event.target.value)} disabled={carregandoLiturgia} className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#d8cec8] bg-white px-3 text-sm font-semibold outline-none focus:border-primary">
          <option value="">{carregandoLiturgia ? "Consultando iLiturgia…" : "Selecione a celebração"}</option>
          {liturgiasDisponiveis.map((item) => <option key={`${item.dataIso}-${item.liturgia}`} value={`${item.dataIso}::${item.liturgia}`}>{item.dataIso.split("-").reverse().join("/")} · {item.liturgia}</option>)}
        </select>
        {form.celebracaoLiturgica && <p className="mt-2 text-xs text-[#6f541a]"><strong>{form.celebracaoLiturgica}</strong>{form.tempoLiturgico ? ` · ${form.tempoLiturgico}` : ""}{form.cicloDominical ? ` · Ano ${form.cicloDominical}` : ""}{form.corLiturgica ? ` · Cor ${form.corLiturgica}` : ""}</p>}
      </div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {CATEGORIAS_ESCALA.map((grupo) => {
          const cadastrados = ativos.filter((membro) => membro.funcao === grupo.funcaoCadastro)
          const rascunho = rascunhos[grupo.id]
          const pessoaEscolhida = membrosPorId.get(rascunho.membroId)
          const adicionados = pessoasEscaladas.filter((pessoa) => pessoa.categoria === grupo.id)

          return (
            <section key={grupo.id} className="min-w-0 rounded-3xl border border-[#ded2cb] bg-[#fffdfb] p-4 shadow-[0_8px_24px_rgba(57,31,36,.04)]">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="font-serif text-xl font-semibold text-[#3a252a]">{grupo.titulo}</h3>
                <span className="rounded-full bg-[#f8f2ed] px-3 py-1 text-xs font-semibold text-[#62575a]">
                  {cadastrados.length} {cadastrados.length === 1 ? "cadastro" : "cadastros"}
                </span>
              </div>

              {!cadastrados.length ? (
                <p className="rounded-2xl border border-dashed border-[#d9ccc5] bg-white px-4 py-7 text-center text-sm text-[#6f6466]">
                  Nenhum {grupo.singular} aprovado cadastrado.
                </p>
              ) : (
                <div className="rounded-2xl border border-[#e1d6d0] bg-white p-3.5">
                  <div className="space-y-2">
                    <Label htmlFor={`seletor-pessoa-${grupo.id}`}>Nome do {grupo.singular}</Label>
                    <button
                      id={`seletor-pessoa-${grupo.id}`}
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={seletorAberto?.tipo === "pessoa" && seletorAberto.categoria === grupo.id}
                      onClick={() => setSeletorAberto({ tipo: "pessoa", categoria: grupo.id })}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-[#d8cec8] bg-white px-4 py-3 text-left text-base font-medium text-[#282124] outline-none transition hover:border-[#a94c5d] focus-visible:border-[#8a1f35] focus-visible:ring-4 focus-visible:ring-[#8a1f35]/15"
                    >
                      <span className={`min-w-0 flex-1 truncate ${pessoaEscolhida ? "text-[#282124]" : "text-[#756d6f]"}`}>
                        {pessoaEscolhida?.nome ?? `Selecionar ${grupo.singular}`}
                      </span>
                      <ChevronDown className="size-5 shrink-0 text-[#76192a]" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`seletor-funcao-${grupo.id}`}>Função na celebração</Label>
                    <button
                      id={`seletor-funcao-${grupo.id}`}
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={seletorAberto?.tipo === "funcao" && seletorAberto.categoria === grupo.id}
                      onClick={() => setSeletorAberto({ tipo: "funcao", categoria: grupo.id })}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-[#d8cec8] bg-white px-4 py-3 text-left text-base font-medium text-[#282124] outline-none transition hover:border-[#a94c5d] focus-visible:border-[#8a1f35] focus-visible:ring-4 focus-visible:ring-[#8a1f35]/15"
                    >
                      <span className={`min-w-0 flex-1 truncate ${rascunho.funcao ? "text-[#282124]" : "text-[#756d6f]"}`}>
                        {rascunho.funcao || "Selecionar função"}
                      </span>
                      <ChevronDown className="size-5 shrink-0 text-[#76192a]" aria-hidden="true" />
                    </button>
                  </div>

                  <Button type="button" className="mt-3 w-full gap-2" onClick={() => adicionarPessoa(grupo.id)} disabled={!rascunho.membroId || !rascunho.funcao}>
                    <Plus className="size-4" aria-hidden="true" />
                    Adicionar à escala
                  </Button>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {adicionados.length ? adicionados.map((pessoa) => {
                  const membro = membrosPorId.get(pessoa.membroId)
                  if (!membro) return null
                  return (
                    <div key={pessoa.membroId} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e1d6d0] bg-white px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#2b2224]">{membro.nome}</p>
                        <p className="mt-0.5 text-xs font-medium text-[#756d6f]">{pessoa.funcao}</p>
                      </div>
                      <button type="button" aria-label={`Remover ${membro.nome} da escala`} onClick={() => removerPessoa(membro.id)} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e0d4ce] bg-[#fffaf7] text-[#8a1f35] transition hover:bg-[#f8e9ed]">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  )
                }) : (
                  <p className="rounded-2xl border border-dashed border-[#ded3cd] bg-white px-4 py-4 text-center text-sm text-[#756d6f]">
                    Nenhum {grupo.singular} adicionado à escala.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {seletorAberto && grupoDoSeletor && rascunhoDoSeletor && (
        <div data-no-pull-refresh className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom)+12px)] sm:items-center sm:p-5" onClick={() => setSeletorAberto(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-seletor-escala" className="flex max-h-full min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#ded1c9] bg-white text-[#251e20] shadow-2xl" onClick={(evento) => evento.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eadfd9] bg-[#fffaf6] px-4 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8a1f35]">{grupoDoSeletor.titulo}</p>
                <h3 id="titulo-seletor-escala" className="mt-1 font-serif text-xl font-semibold text-[#2c2023]">
                  {seletorAberto.tipo === "pessoa" ? `Escolher ${grupoDoSeletor.singular}` : "Escolher função"}
                </h3>
              </div>
              <button type="button" aria-label="Fechar lista" onClick={() => setSeletorAberto(null)} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#ded1c9] bg-white text-[#6f2635]">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div role="listbox" aria-label={seletorAberto.tipo === "pessoa" ? `Lista de ${grupoDoSeletor.titulo}` : "Funções disponíveis"} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-white p-3 pb-6 text-[#251e20]">
              {seletorAberto.tipo === "pessoa" ? (
                pessoasDoSeletor.map((membro) => {
                  const selecionado = rascunhoDoSeletor.membroId === membro.id
                  const indisponivel = idsEscalados.has(membro.id)
                  return (
                    <button type="button" role="option" aria-selected={selecionado} key={membro.id} disabled={indisponivel} onClick={() => escolherPessoa(seletorAberto.categoria, membro.id)} className={`mb-2 flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-semibold ${selecionado ? "border-[#8a1f35] bg-[#f8e9ed] text-[#711a2d]" : indisponivel ? "border-[#ebe5e1] bg-[#f6f3f1] text-[#827779]" : "border-[#e2d8d2] bg-white text-[#2b2224] hover:border-[#b86a78] hover:bg-[#fff9f7]"}`}>
                      <span>
                        {membro.nome}
                        {indisponivel && <span className="mt-0.5 block text-xs font-medium text-[#827779]">Já adicionado</span>}
                      </span>
                      {selecionado && <Check className="size-5 shrink-0 text-[#8a1f35]" aria-hidden="true" />}
                    </button>
                  )
                })
              ) : (
                <>
                  <button type="button" role="option" aria-selected={!rascunhoDoSeletor.funcao} onClick={() => escolherFuncao(seletorAberto.categoria, "")} className={`mb-2 flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-semibold ${!rascunhoDoSeletor.funcao ? "border-[#8a1f35] bg-[#f8e9ed] text-[#711a2d]" : "border-[#e2d8d2] bg-white text-[#2b2224]"}`}>
                    <span>Sem função selecionada</span>
                    {!rascunhoDoSeletor.funcao && <Check className="size-5 text-[#8a1f35]" aria-hidden="true" />}
                  </button>

                  {FUNCOES_ESCALA.map((funcao) => {
                    const selecionada = rascunhoDoSeletor.funcao === funcao
                    const indisponivel = funcoesOcupadas.has(funcao)
                    return (
                      <button type="button" role="option" aria-selected={selecionada} key={funcao} disabled={indisponivel} onClick={() => escolherFuncao(seletorAberto.categoria, funcao)} className={`mb-2 flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-semibold ${selecionada ? "border-[#8a1f35] bg-[#f8e9ed] text-[#711a2d]" : indisponivel ? "border-[#ebe5e1] bg-[#f6f3f1] text-[#827779]" : "border-[#e2d8d2] bg-white text-[#2b2224] hover:border-[#b86a78] hover:bg-[#fff9f7]"}`}>
                        <span>
                          {funcao}
                          {indisponivel && <span className="mt-0.5 block text-xs font-medium text-[#827779]">Já atribuída</span>}
                        </span>
                        {selecionada && <Check className="size-5 shrink-0 text-[#8a1f35]" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Label htmlFor="escala-observacoes">Observações</Label>
        <Input id="escala-observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações opcionais" />
      </div>

      {mensagem && (
        <div className={`mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${mensagem.tipo === "erro" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`}>
          {mensagem.tipo === "erro" ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
          {mensagem.texto}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2"><Button className="gap-2" onClick={publicar} disabled={salvando}>
        {salvando && <Loader2 className="size-4 animate-spin" />}
        {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Publicar escala"}
      </Button>{editandoId && <Button type="button" variant="outline" onClick={cancelarEdicao} disabled={salvando}>Cancelar edição</Button>}</div>

      <div className="mt-7">
        <h3 className="mb-3 font-semibold">Escalas publicadas</h3>
        {error ? (
          <p className="text-sm text-destructive">Não foi possível carregar as escalas publicadas.</p>
        ) : !(data?.escalas?.length) ? (
          <p className="text-sm text-muted-foreground">Nenhuma escala publicada.</p>
        ) : (
          <div className="space-y-2">
            {data.escalas.map((escala) => (
              <div key={escala.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span>{escala.data.split("-").reverse().join("/")} · {escala.horario} · {escala.celebrante}</span>
                <div className="flex gap-2">{windowsBeta && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => iniciarEdicao(escala)}><FilePenLine className="size-4" /> Editar</Button>}<Button variant="outline" size="sm" className="gap-1.5" onClick={() => excluir(escala.id)}>
                  <Trash2 className="size-4" /> Excluir
                </Button></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
