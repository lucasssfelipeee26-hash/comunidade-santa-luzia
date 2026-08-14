"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Save, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Situacao = "nao_registrado" | "presente" | "falta" | "justificada"

type Participante = {
  id: string
  nome: string
  funcao: string
  tipo: "moderador" | "membro"
  editavel: boolean
  motivo_bloqueio: string | null
  situacao: Situacao
  justificativa: string
  atualizado_em: number | null
}

const OPCOES: Array<{ id: Situacao; rotulo: string; classe: string }> = [
  { id: "nao_registrado", rotulo: "Não marcado", classe: "border-[#d8cec8] bg-white text-[#675e60]" },
  { id: "presente", rotulo: "Presente", classe: "border-emerald-600 bg-emerald-50 text-emerald-800" },
  { id: "falta", rotulo: "Faltou", classe: "border-red-600 bg-red-50 text-red-800" },
  { id: "justificada", rotulo: "Justificada", classe: "border-amber-600 bg-amber-50 text-amber-900" },
]

export function FormacaoPresencasEditor({ formacaoId }: { formacaoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null)

  async function carregar() {
    setCarregando(true)
    setMensagem(null)
    try {
      const response = await fetch(`/api/formacoes/${formacaoId}/presencas`, { cache: "no-store" })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json) throw new Error(json?.erro ?? "Não foi possível carregar a lista de presença.")
      setParticipantes(json.participantes ?? [])
      setCarregado(true)
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof Error ? erro.message : "Não foi possível carregar a lista de presença.",
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (aberto && !carregado) void carregar()
  }, [aberto, carregado])

  const resumo = useMemo(() => ({
    presentes: participantes.filter((item) => item.situacao === "presente").length,
    faltas: participantes.filter((item) => item.situacao === "falta").length,
    justificadas: participantes.filter((item) => item.situacao === "justificada").length,
  }), [participantes])

  function alterarSituacao(usuarioId: string, situacao: Situacao) {
    setParticipantes((atuais) => atuais.map((item) =>
      item.id === usuarioId && item.editavel
        ? { ...item, situacao, justificativa: situacao === "justificada" ? item.justificativa : "" }
        : item,
    ))
    setMensagem(null)
  }

  function alterarJustificativa(usuarioId: string, justificativa: string) {
    setParticipantes((atuais) => atuais.map((item) =>
      item.id === usuarioId && item.editavel ? { ...item, justificativa } : item,
    ))
    setMensagem(null)
  }

  async function salvar() {
    const semJustificativa = participantes.find(
      (item) => item.editavel && item.situacao === "justificada" && item.justificativa.trim().length < 3,
    )
    if (semJustificativa) {
      setMensagem({ tipo: "erro", texto: `Informe a justificativa da falta de ${semJustificativa.nome}.` })
      return
    }

    setSalvando(true)
    setMensagem(null)
    try {
      const response = await fetch(`/api/formacoes/${formacaoId}/presencas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presencas: participantes.filter((item) => item.editavel).map((item) => ({
            usuarioId: item.id,
            situacao: item.situacao,
            justificativa: item.justificativa,
          })),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.erro ?? "Não foi possível salvar a lista de presença.")
      setMensagem({ tipo: "sucesso", texto: "Lista de presença salva com sucesso." })
      window.dispatchEvent(new Event("santa-luzia:server-sync"))
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof Error ? erro.message : "Não foi possível salvar a lista de presença.",
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div data-no-pull-refresh className="mt-4 rounded-2xl border border-[#ded2cb] bg-[#fffaf7]">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold text-[#6f1d30]"
      >
        <span className="flex items-center gap-2">
          <UserCheck className="size-5" aria-hidden="true" />
          Registrar presença
        </span>
        {aberto ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
      </button>

      {aberto && (
        <div className="border-t border-[#e5d9d2] p-3 sm:p-4">
          {carregando ? (
            <p className="flex items-center gap-2 py-5 text-sm text-[#756d6f]">
              <Loader2 className="size-4 animate-spin" /> Carregando participantes...
            </p>
          ) : participantes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-[#756d6f]">
              Nenhum acólito ou coroinha aprovado cadastrado.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{resumo.presentes} presentes</span>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{resumo.faltas} faltas</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">{resumo.justificadas} justificadas</span>
              </div>

              <div className="space-y-3">
                {participantes.map((participante) => (
                  <article key={participante.id} className={`rounded-2xl border p-3.5 ${participante.editavel ? "border-[#e2d8d2] bg-white" : "border-[#ded8d4] bg-[#f5f2f0]"}`}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#2b2224]">{participante.nome}</p>
                        <p className="text-xs font-medium text-[#756d6f]">
                          {participante.funcao}{participante.tipo === "moderador" ? " · Moderador" : ""}
                        </p>
                      </div>
                      {!participante.editavel && (
                        <span className="rounded-full border border-[#d7cec9] bg-white px-2.5 py-1 text-[11px] font-bold text-[#6e6567]">
                          Somente leitura
                        </span>
                      )}
                    </div>
                    {!participante.editavel && participante.motivo_bloqueio && (
                      <p className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                        {participante.motivo_bloqueio}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={`Presença de ${participante.nome}`}>
                      {OPCOES.map((opcao) => {
                        const ativa = participante.situacao === opcao.id
                        return (
                          <button
                            key={opcao.id}
                            type="button"
                            role="radio"
                            aria-checked={ativa}
                            onClick={() => alterarSituacao(participante.id, opcao.id)}
                            disabled={!participante.editavel}
                            className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-65 ${ativa ? `${opcao.classe} ring-2 ring-current/20` : "border-[#ded5d0] bg-white text-[#5f5658]"}`}
                          >
                            {opcao.rotulo}
                          </button>
                        )
                      })}
                    </div>

                    {participante.situacao === "justificada" && (
                      <div className="mt-3">
                        <label htmlFor={`justificativa-${formacaoId}-${participante.id}`} className="mb-1.5 block text-xs font-semibold text-[#5f5658]">
                          Justificativa da falta
                        </label>
                        <Input
                          id={`justificativa-${formacaoId}-${participante.id}`}
                          value={participante.justificativa}
                          onChange={(evento) => alterarJustificativa(participante.id, evento.target.value)}
                          disabled={!participante.editavel}
                          maxLength={500}
                          placeholder="Informe o motivo da ausência"
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <Button type="button" onClick={salvar} disabled={salvando} className="mt-4 w-full gap-2 sm:w-auto">
                {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {salvando ? "Salvando..." : "Salvar alterações permitidas"}
              </Button>
            </>
          )}

          {mensagem && (
            <p className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${mensagem.tipo === "erro" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {mensagem.tipo === "erro" ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
              {mensagem.texto}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
