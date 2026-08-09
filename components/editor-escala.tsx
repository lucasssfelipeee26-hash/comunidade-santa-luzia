"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from "lucide-react"
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

  const ativos = useMemo(() => membros.filter((m) => m.status === "aprovado"), [membros])

  const funcoesOcupadas = useMemo(() => {
    const ocupadas = new Map<string, string>()
    for (const [membroId, funcao] of Object.entries(selecionados)) {
      if (funcao) ocupadas.set(funcao, membroId)
    }
    return ocupadas
  }, [selecionados])

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

    const pessoas = ativos
      .filter((m) => selecionados[m.id])
      .map((m) => ({
        id: m.id,
        nome: m.nome,
        categoria: m.funcao === "Acólito" ? "acolito" : "coroinha",
        funcao: selecionados[m.id],
      }))

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

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {(["Acólito", "Coroinha"] as const).map((categoria) => {
          const lista = ativos.filter((m) => m.funcao === categoria)
          const funcoes = FUNCOES_ESCALA
          return (
            <div key={categoria}>
              <h3 className="mb-3 font-semibold">{categoria}s</h3>
              {!lista.length ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nenhum {categoria.toLowerCase()} aprovado cadastrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {lista.map((membro) => (
                    <div key={membro.id} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_190px] sm:items-center">
                      <span className="text-sm font-medium">{membro.nome}</span>
                      <select
                        aria-label={`Função de ${membro.nome}`}
                        className="rounded-md border bg-background px-2 py-2 text-sm"
                        value={selecionados[membro.id] ?? ""}
                        onChange={(e) => setSelecionados((atual) => ({ ...atual, [membro.id]: e.target.value }))}
                      >
                        <option value="">Fora da escala</option>
                        {funcoes.map((funcao) => {
                          const ocupante = funcoesOcupadas.get(funcao)
                          return (
                            <option key={funcao} value={funcao} disabled={Boolean(ocupante && ocupante !== membro.id)}>
                              {funcao}{ocupante && ocupante !== membro.id ? " — já atribuído" : ""}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
