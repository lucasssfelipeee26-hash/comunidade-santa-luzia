"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Trash2, X } from "lucide-react"
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
}

type EscalasResponse = { ok: boolean; escalas: Escala[]; erro?: string }

type CategoriaEscala = "acolito" | "coroinha"

const CATEGORIAS_ESCALA: Array<{ id: CategoriaEscala; titulo: string }> = [
  { id: "acolito", titulo: "Acólitos" },
  { id: "coroinha", titulo: "Coroinhas" },
]

function chaveSelecao(categoria: CategoriaEscala, membroId: string) {
  return `${categoria}:${membroId}`
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
  const [form, setForm] = useState({ data: hojeCuiaba(), horario: "18:00", celebrante: "", observacoes: "" })
  const [selecionados, setSelecionados] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null)
  const [seletorAberto, setSeletorAberto] = useState<{ membroId: string; categoria: CategoriaEscala } | null>(null)

  const ativos = useMemo(
    () => membros
      .filter((m) => m.status === "aprovado")
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [membros],
  )

  const funcoesOcupadas = useMemo(() => {
    const ocupadas = new Map<string, string>()
    for (const [membroId, funcao] of Object.entries(selecionados)) {
      if (funcao) ocupadas.set(funcao, membroId)
    }
    return ocupadas
  }, [selecionados])

  const membroNoSeletor = seletorAberto
    ? ativos.find((membro) => membro.id === seletorAberto.membroId) ?? null
    : null
  const chaveNoSeletor = seletorAberto
    ? chaveSelecao(seletorAberto.categoria, seletorAberto.membroId)
    : ""

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

  function escolherFuncao(categoria: CategoriaEscala, membroId: string, funcao: string) {
    setSelecionados((atual) => {
      const proximo = { ...atual }
      const chaveAtual = chaveSelecao(categoria, membroId)
      const outraCategoria: CategoriaEscala = categoria === "acolito" ? "coroinha" : "acolito"
      const chaveOutra = chaveSelecao(outraCategoria, membroId)

      if (!funcao) {
        delete proximo[chaveAtual]
      } else {
        // A mesma pessoa não pode ocupar os dois blocos na mesma escala.
        delete proximo[chaveOutra]
        proximo[chaveAtual] = funcao
      }
      return proximo
    })
    setSeletorAberto(null)
  }

  async function publicar() {
    if (salvando) return
    setMensagem(null)

    if (!form.data || !form.horario || !form.celebrante.trim()) {
      setMensagem({ tipo: "erro", texto: "Informe data, horário e o sacerdote celebrante." })
      return
    }

    const funcoesEscolhidas = Object.values(selecionados).filter(Boolean)
    if (new Set(funcoesEscolhidas).size !== funcoesEscolhidas.length) {
      setMensagem({ tipo: "erro", texto: "Cada função da escala deve ser atribuída a apenas uma pessoa." })
      return
    }

    const pessoas = CATEGORIAS_ESCALA.flatMap(({ id: categoria }) =>
      ativos
        .filter((membro) => selecionados[chaveSelecao(categoria, membro.id)])
        .map((membro) => ({
          id: membro.id,
          nome: membro.nome,
          categoria,
          funcao: selecionados[chaveSelecao(categoria, membro.id)],
        })),
    )

    setSalvando(true)
    try {
      const response = await fetch("/api/escalas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pessoas }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(json?.erro ?? "Erro ao publicar a escala.")
      }

      setSelecionados({})
      setForm((atual) => ({ ...atual, celebrante: "", observacoes: "" }))
      await mutate()
      setMensagem({ tipo: "sucesso", texto: "Escala publicada com sucesso." })
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
      <h2 className="font-serif text-2xl text-primary">Montar Escala do Dia</h2>
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

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {CATEGORIAS_ESCALA.map((grupo) => (
          <section key={grupo.id} className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-serif text-xl font-semibold text-[#3a252a]">{grupo.titulo}</h3>
              <span className="rounded-full bg-[#f8f2ed] px-3 py-1 text-xs font-semibold text-[#62575a]">
                {ativos.length} {ativos.length === 1 ? "cadastro" : "cadastros"}
              </span>
            </div>

            {!ativos.length ? (
              <p className="rounded-2xl border border-dashed border-[#d9ccc5] bg-white px-4 py-7 text-center text-sm text-[#6f6466]">
                Nenhum usuário aprovado cadastrado.
              </p>
            ) : (
              <div className="space-y-3">
                {ativos.map((membro) => {
                  const chaveAtual = chaveSelecao(grupo.id, membro.id)
                  const outraCategoria: CategoriaEscala = grupo.id === "acolito" ? "coroinha" : "acolito"
                  const chaveOutra = chaveSelecao(outraCategoria, membro.id)
                  const selecionadoNoOutro = selecionados[chaveOutra]
                  return (
                    <div key={chaveAtual} className="rounded-2xl border border-[#ddd2cc] bg-white p-3.5 shadow-[0_6px_18px_rgba(57,31,36,.04)]">
                      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold leading-5 text-[#2b2224]">{membro.nome}</span>
                        {selecionadoNoOutro ? (
                          <span className="rounded-full border border-[#d8c9c1] bg-[#f7f2ef] px-2.5 py-1 text-[10px] font-bold text-[#756a6d]">
                            Em {outraCategoria === "acolito" ? "Acólitos" : "Coroinhas"}
                          </span>
                        ) : (
                          <span className="rounded-full border border-[#d8c9c1] bg-[#faf7f4] px-2.5 py-1 text-[10px] font-bold text-[#756a6d]">
                            Disponível
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={seletorAberto?.membroId === membro.id && seletorAberto.categoria === grupo.id}
                        onClick={() => setSeletorAberto({ membroId: membro.id, categoria: grupo.id })}
                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-[#d8cec8] bg-white px-4 py-3 text-left text-base font-medium text-[#282124] outline-none transition hover:border-[#a94c5d] focus-visible:border-[#8a1f35] focus-visible:ring-4 focus-visible:ring-[#8a1f35]/15"
                      >
                        <span className="min-w-0 flex-1 truncate">{selecionados[chaveAtual] || "Fora da escala"}</span>
                        <ChevronDown className="size-5 shrink-0 text-[#76192a]" aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      {membroNoSeletor && seletorAberto && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-5"
          onClick={() => setSeletorAberto(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-seletor-funcao"
            className="flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#ded1c9] bg-white text-[#251e20] shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#eadfd9] bg-[#fffaf6] px-4 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8a1f35]">
                  {seletorAberto.categoria === "acolito" ? "Bloco de Acólitos" : "Bloco de Coroinhas"}
                </p>
                <h3 id="titulo-seletor-funcao" className="mt-1 truncate font-serif text-xl font-semibold text-[#2c2023]">
                  {membroNoSeletor.nome}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Fechar lista de funções"
                onClick={() => setSeletorAberto(null)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#ded1c9] bg-white text-[#6f2635]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div role="listbox" aria-label={`Funções disponíveis para ${membroNoSeletor.nome}`} className="overflow-y-auto overscroll-contain bg-white p-3 text-[#251e20]">
              <button
                type="button"
                role="option"
                aria-selected={!selecionados[chaveNoSeletor]}
                onClick={() => escolherFuncao(seletorAberto.categoria, membroNoSeletor.id, "")}
                className={`mb-2 flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-semibold ${
                  !selecionados[chaveNoSeletor]
                    ? "border-[#8a1f35] bg-[#f8e9ed] text-[#711a2d]"
                    : "border-[#e2d8d2] bg-white text-[#2b2224]"
                }`}
              >
                <span>Fora da escala</span>
                {!selecionados[chaveNoSeletor] && <Check className="size-5 text-[#8a1f35]" aria-hidden="true" />}
              </button>

              {FUNCOES_ESCALA.map((funcao) => {
                const ocupante = funcoesOcupadas.get(funcao)
                const indisponivel = Boolean(ocupante && ocupante !== chaveNoSeletor)
                const selecionada = selecionados[chaveNoSeletor] === funcao
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selecionada}
                    key={funcao}
                    disabled={indisponivel}
                    onClick={() => escolherFuncao(seletorAberto.categoria, membroNoSeletor.id, funcao)}
                    className={`mb-2 flex min-h-13 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-semibold ${
                      selecionada
                        ? "border-[#8a1f35] bg-[#f8e9ed] text-[#711a2d]"
                        : indisponivel
                          ? "border-[#ebe5e1] bg-[#f6f3f1] text-[#827779]"
                          : "border-[#e2d8d2] bg-white text-[#2b2224] hover:border-[#b86a78] hover:bg-[#fff9f7]"
                    }`}
                  >
                    <span>
                      {funcao}
                      {indisponivel && <span className="mt-0.5 block text-xs font-medium text-[#827779]">Já atribuída</span>}
                    </span>
                    {selecionada && <Check className="size-5 shrink-0 text-[#8a1f35]" aria-hidden="true" />}
                  </button>
                )
              })}
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

      <Button className="mt-4 gap-2" onClick={publicar} disabled={salvando}>
        {salvando && <Loader2 className="size-4 animate-spin" />}
        {salvando ? "Publicando..." : "Publicar escala"}
      </Button>

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
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => excluir(escala.id)}>
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
