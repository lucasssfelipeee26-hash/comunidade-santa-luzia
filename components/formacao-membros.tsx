"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  History,
  Loader2,
  Save,
  ShieldCheck,
  WifiOff,
  XCircle,
} from "lucide-react"
import type { FormacaoPresencaStatus, FormacaoRow } from "@/lib/db"
import {
  carregarCacheFormacoes,
  enviarOuEnfileirarMinhaPresencaFormacao,
  listarPresencasFormacaoPendentes,
  OFFLINE_DATA_EVENT,
  salvarCacheFormacoes,
  type MinhaPresencaFormacaoSituacao,
} from "@/lib/offline-data"

type MinhaPresenca = {
  status: FormacaoPresencaStatus
  justificativa: string | null
  atualizado_em: number
  pendente?: boolean
}

type FormacaoComPresenca = FormacaoRow & {
  minha_presenca: MinhaPresenca | null
}

type FormacoesResponse = {
  formacoes: FormacaoComPresenca[]
  usuarioId: string
  tipoUsuario: "moderador" | "membro"
}

function formatarData(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Cuiaba",
  }).format(new Date(`${value}T12:00:00-04:00`))
}

function tamanho(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function dadosSituacao(status: FormacaoPresencaStatus) {
  if (status === "presente") {
    return {
      rotulo: "Presente",
      classe: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icone: <CheckCircle2 className="size-4" aria-hidden="true" />,
    }
  }
  if (status === "justificada") {
    return {
      rotulo: "Falta justificada",
      classe: "border-amber-200 bg-amber-50 text-amber-900",
      icone: <ShieldCheck className="size-4" aria-hidden="true" />,
    }
  }
  return {
    rotulo: "Faltou",
    classe: "border-red-200 bg-red-50 text-red-800",
    icone: <XCircle className="size-4" aria-hidden="true" />,
  }
}

export function FormacaoMembros() {
  const [resposta, setResposta] = useState<FormacoesResponse | null>(null)
  const [erro, setErro] = useState("")
  const [online, setOnline] = useState(true)
  const [revisaoLocal, setRevisaoLocal] = useState(0)

  useEffect(() => {
    let ativo = true

    const cache = carregarCacheFormacoes<FormacoesResponse>()
    if (cache?.dados?.usuarioId && Array.isArray(cache.dados.formacoes)) {
      setResposta(cache.dados)
    }

    async function carregar() {
      try {
        const response = await fetch("/api/formacoes", { cache: "no-store", credentials: "same-origin" })
        const json = await response.json().catch(() => null) as FormacoesResponse & { erro?: string }
        if (!response.ok || !json || !Array.isArray(json.formacoes)) {
          throw new Error(json?.erro || "Erro ao carregar formações.")
        }
        if (ativo) {
          setResposta(json)
          salvarCacheFormacoes(json)
          setErro("")
        }
      } catch (falha) {
        if (ativo && !carregarCacheFormacoes<FormacoesResponse>()?.dados) {
          setErro(falha instanceof Error ? falha.message : "Erro ao carregar formações.")
        }
      }
    }

    const atualizarRede = () => setOnline(navigator.onLine)
    const aoSincronizar = () => void carregar()
    const aoAtualizarOffline = () => setRevisaoLocal((valor) => valor + 1)

    atualizarRede()
    void carregar()
    window.addEventListener("online", atualizarRede)
    window.addEventListener("offline", atualizarRede)
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    window.addEventListener(OFFLINE_DATA_EVENT, aoAtualizarOffline)

    return () => {
      ativo = false
      window.removeEventListener("online", atualizarRede)
      window.removeEventListener("offline", atualizarRede)
      window.removeEventListener("santa-luzia:server-sync", aoSincronizar)
      window.removeEventListener(OFFLINE_DATA_EVENT, aoAtualizarOffline)
    }
  }, [])

  const itens = useMemo(() => {
    if (!resposta) return []
    const pendentes = new Map(
      listarPresencasFormacaoPendentes(resposta.usuarioId)
        .map((item) => [item.formacaoId, item]),
    )
    return resposta.formacoes.map((formacao) => {
      const pendente = pendentes.get(formacao.id)
      if (!pendente) return formacao
      return {
        ...formacao,
        minha_presenca: {
          status: pendente.payload.situacao,
          justificativa: pendente.payload.situacao === "justificada"
            ? pendente.payload.justificativa
            : null,
          atualizado_em: pendente.criadoNoAparelhoEm,
          pendente: true,
        },
      }
    })
  }, [resposta, revisaoLocal])

  function atualizarMinhaPresenca(formacaoId: string, presenca: MinhaPresenca) {
    setResposta((atual) => {
      if (!atual) return atual
      const proxima = {
        ...atual,
        formacoes: atual.formacoes.map((item) =>
          item.id === formacaoId ? { ...item, minha_presenca: presenca } : item,
        ),
      }
      salvarCacheFormacoes(proxima)
      return proxima
    })
    setRevisaoLocal((valor) => valor + 1)
  }

  const ordenados = useMemo(() => [...itens].sort((a, b) => a.data.localeCompare(b.data)), [itens])
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
  const proximos = ordenados.filter((item) => item.data >= hoje)
  const passados = [...ordenados].filter((item) => item.data < hoje).reverse()
  const historico = [...ordenados]
    .filter((item) => item.minha_presenca)
    .sort((a, b) => b.data.localeCompare(a.data))

  if (erro && !resposta) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">{erro}</div>
  }
  if (!resposta) {
    return <p className="flex items-center gap-2 rounded-xl border bg-white p-5 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando formações...</p>
  }

  return (
    <div className="space-y-8">
      {!online && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="size-4 shrink-0" />
          Você está sem internet. Sua marcação ficará salva neste aparelho e será enviada automaticamente quando a conexão voltar.
        </p>
      )}

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-serif text-3xl text-[#0b4b35]">
          <CalendarDays className="size-6 text-[#9a731d]" /> Próximas formações
        </h2>
        {proximos.length === 0 ? (
          <p className="rounded-xl border bg-white p-5 text-muted-foreground">
            Nenhuma formação futura publicada no momento.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {proximos.map((item) => (
              <Card
                key={item.id}
                item={item}
                usuarioId={resposta.usuarioId}
                onAtualizada={(presenca) => atualizarMinhaPresenca(item.id, presenca)}
              />
            ))}
          </div>
        )}
      </section>

      {passados.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl text-[#0b4b35]">
            <BookOpen className="size-5 text-[#9a731d]" /> Materiais de formações anteriores
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {passados.map((item) => (
              <Card
                key={item.id}
                item={item}
                usuarioId={resposta.usuarioId}
                onAtualizada={(presenca) => atualizarMinhaPresenca(item.id, presenca)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl text-[#0b4b35]">
          <History className="size-5 text-[#9a731d]" /> Meu histórico de participação
        </h2>
        {historico.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-muted-foreground">
            Sua presença ainda não foi registrada em nenhuma formação.
          </p>
        ) : (
          <div className="space-y-3">
            {historico.map((item) => {
              const presenca = item.minha_presenca
              if (!presenca) return null
              const situacao = dadosSituacao(presenca.status)
              return (
                <article key={item.id} className="rounded-xl border border-[#d4af37]/35 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9a731d]">
                        {formatarData(item.data)}{item.horario ? ` · ${item.horario}` : ""}
                      </p>
                      <h3 className="mt-1 font-serif text-xl text-[#123f2e]">{item.titulo}</h3>
                      <p className="text-sm text-[#6d6255]">Tema: {item.tema}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${situacao.classe}`}>
                      {situacao.icone}
                      {situacao.rotulo}
                    </span>
                  </div>
                  {presenca.pendente && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                      <Clock3 className="size-4" /> Pendente de sincronização automática.
                    </p>
                  )}
                  {presenca.status === "justificada" && presenca.justificativa && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>Justificativa:</strong> {presenca.justificativa}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Card({
  item,
  usuarioId,
  onAtualizada,
}: {
  item: FormacaoComPresenca
  usuarioId: string
  onAtualizada: (presenca: MinhaPresenca) => void
}) {
  return (
    <article className={`rounded-xl border bg-white p-5 shadow-sm ${item.status === "cancelada" ? "border-destructive/40" : "border-[#d4af37]/35"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#9a731d]">
            {formatarData(item.data)}{item.horario ? ` · ${item.horario}` : ""}
          </p>
          <h3 className="mt-2 font-serif text-2xl text-[#123f2e]">{item.titulo}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "cancelada" ? "bg-destructive/10 text-destructive" : "bg-[#073b29]/10 text-[#073b29]"}`}>
          {item.status === "cancelada" ? "CANCELADA" : "CONFIRMADA"}
        </span>
      </div>
      <p className="mt-3 font-semibold text-[#7f5e15]">Tema: {item.tema}</p>
      {item.descricao && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5f5a4e]">{item.descricao}</p>}
      {item.status === "cancelada" && (
        <div className="mt-4 flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span><strong>Formação cancelada.</strong>{item.motivo_cancelamento ? ` ${item.motivo_cancelamento}` : ""}</span>
        </div>
      )}
      {item.status !== "cancelada" && (
        <MinhaPresencaControle
          formacaoId={item.id}
          usuarioId={usuarioId}
          presenca={item.minha_presenca}
          onAtualizada={onAtualizada}
        />
      )}
      {item.arquivo && (
        <a href={`/api/formacoes/${item.id}/download`} className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#d4af37] bg-[#fffaf0] px-4 py-2.5 text-sm font-semibold text-[#755611] hover:bg-[#d4af37] hover:text-[#073b29]">
          <Download className="size-4" /> Baixar {item.arquivo.nome_original}
          <span className="text-xs opacity-70">({tamanho(item.arquivo.tamanho)})</span>
        </a>
      )}
      {!item.arquivo && (
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-4" /> Sem arquivo anexado.
        </p>
      )}
    </article>
  )
}

const OPCOES: Array<{ id: MinhaPresencaFormacaoSituacao; rotulo: string; classe: string }> = [
  { id: "presente", rotulo: "Presente", classe: "border-emerald-600 bg-emerald-50 text-emerald-800" },
  { id: "falta", rotulo: "Falta", classe: "border-red-600 bg-red-50 text-red-800" },
  { id: "justificada", rotulo: "Falta justificada", classe: "border-amber-600 bg-amber-50 text-amber-900" },
]

function MinhaPresencaControle({
  formacaoId,
  usuarioId,
  presenca,
  onAtualizada,
}: {
  formacaoId: string
  usuarioId: string
  presenca: MinhaPresenca | null
  onAtualizada: (presenca: MinhaPresenca) => void
}) {
  const [situacao, setSituacao] = useState<MinhaPresencaFormacaoSituacao | null>(presenca?.status ?? null)
  const [justificativa, setJustificativa] = useState(presenca?.justificativa ?? "")
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null)

  useEffect(() => {
    setSituacao(presenca?.status ?? null)
    setJustificativa(presenca?.justificativa ?? "")
  }, [presenca?.status, presenca?.justificativa])

  async function salvar() {
    if (!situacao) {
      setMensagem({ tipo: "erro", texto: "Escolha sua situação na formação." })
      return
    }
    if (situacao === "justificada" && justificativa.trim().length < 3) {
      setMensagem({ tipo: "erro", texto: "Informe o motivo da falta justificada." })
      return
    }

    setSalvando(true)
    setMensagem(null)
    const resultado = await enviarOuEnfileirarMinhaPresencaFormacao(
      formacaoId,
      { situacao, justificativa: situacao === "justificada" ? justificativa.trim() : "" },
      usuarioId,
    )

    if (!resultado.ok) {
      setMensagem({ tipo: "erro", texto: resultado.erro })
      setSalvando(false)
      return
    }

    const atualizada: MinhaPresenca = resultado.pendente
      ? {
          status: situacao,
          justificativa: situacao === "justificada" ? justificativa.trim() : null,
          atualizado_em: Date.now(),
          pendente: true,
        }
      : resultado.resposta.presenca

    onAtualizada(atualizada)
    setMensagem({
      tipo: "sucesso",
      texto: resultado.pendente
        ? "Salvo no aparelho. Será enviado automaticamente quando a internet voltar."
        : "Sua presença foi registrada.",
    })
    setSalvando(false)
  }

  return (
    <div data-no-pull-refresh className="mt-4 rounded-2xl border border-[#e2d8d2] bg-[#fffaf7] p-3.5">
      <p className="mb-2 text-sm font-bold text-[#6f1d30]">Minha presença</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Minha situação nesta formação">
        {OPCOES.map((opcao) => {
          const ativa = situacao === opcao.id
          return (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={ativa}
              onClick={() => {
                setSituacao(opcao.id)
                if (opcao.id !== "justificada") setJustificativa("")
                setMensagem(null)
              }}
              className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition ${ativa ? `${opcao.classe} ring-2 ring-current/20` : "border-[#ded5d0] bg-white text-[#5f5658]"}`}
            >
              {opcao.rotulo}
            </button>
          )
        })}
      </div>

      {situacao === "justificada" && (
        <div className="mt-3">
          <label htmlFor={`minha-justificativa-${formacaoId}`} className="mb-1.5 block text-xs font-semibold text-[#5f5658]">
            Justificativa
          </label>
          <textarea
            id={`minha-justificativa-${formacaoId}`}
            value={justificativa}
            onChange={(evento) => setJustificativa(evento.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Informe o motivo da ausência"
            className="w-full resize-y rounded-xl border border-[#d8cec8] bg-white px-3 py-2.5 text-sm text-[#2b2224] outline-none focus:border-[#8f1934] focus:ring-2 focus:ring-[#8f1934]/15"
          />
        </div>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando || !usuarioId}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#8f1934] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {salvando ? "Salvando..." : "Salvar minha presença"}
      </button>

      {presenca?.pendente && (
        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-sky-800">
          <Clock3 className="size-4" /> Pendente de sincronização.
        </p>
      )}
      {mensagem && (
        <p className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${mensagem.tipo === "erro" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {mensagem.tipo === "erro" ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
          {mensagem.texto}
        </p>
      )}
    </div>
  )
}
