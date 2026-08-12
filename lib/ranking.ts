import {
  listarEscalas,
  listarMembrosAprovados,
  listarPontualidadeOcorrencias,
  listarQuizzes,
  listarRankingAjustes,
  listarReconhecimentos,
  listarRespostasQuiz,
  obterRankingConfig,
  type QuizOrigem,
} from "@/lib/db"

export type RankingLinha = {
  posicao: number
  usuarioId: string
  nome: string
  funcao: string | null
  foto?: string | null
  pontos: number
  formacao: number
  liturgia: number
  pontualidade: number
  reconhecimento: number
  ajustes: number
  reconhecimentos: number
  atrasosConfirmados: number
  escalasNoAno: number
  quizzesRespondidos: number
}

function quizAno(q: { data_referencia: string | null; criado_em: number }) {
  if (q.data_referencia && /^\d{4}-/.test(q.data_referencia)) return Number(q.data_referencia.slice(0, 4))
  return new Date(q.criado_em).getFullYear()
}

function percentualQuizzes(usuarioId: string, origem: QuizOrigem, ano: number) {
  const quizzes = listarQuizzes(false).filter((q) => q.origem === origem && quizAno(q) === ano)
  if (!quizzes.length) return { percentual: 0, respondidos: 0 }

  const respostas = listarRespostasQuiz().filter((r) => r.usuario_id === usuarioId)
  const possivel = quizzes.reduce((s, q) => s + q.perguntas.reduce((p, x) => p + Math.max(0, x.pontos || 0), 0), 0)
  const obtido = quizzes.reduce((s, q) => s + (respostas.find((r) => r.quiz_id === q.id)?.pontos || 0), 0)
  const respondidos = quizzes.filter((q) => respostas.some((r) => r.quiz_id === q.id)).length
  return { percentual: possivel > 0 ? Math.min(1, obtido / possivel) : 0, respondidos }
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function calcularRanking(ano: number): { config: ReturnType<typeof obterRankingConfig>; ranking: RankingLinha[] } {
  const membros = listarMembrosAprovados()
  const escalas = listarEscalas().filter((e) => e.data.startsWith(`${ano}-`))
  const ocorrencias = listarPontualidadeOcorrencias(false).filter((o) => o.status === "confirmado" && o.data_missa.startsWith(`${ano}-`))
  const reconhecimentos = listarReconhecimentos(ano)
  const ajustes = listarRankingAjustes(ano)
  const config = obterRankingConfig(ano)

  const linhas = membros.map((m) => {
    const formacao = percentualQuizzes(m.id, "formacao", ano)
    const liturgia = percentualQuizzes(m.id, "liturgia", ano)
    const escalasNoAno = escalas.filter((e) => e.pessoas.some((p) => p.id === m.id || (!p.id && normalizeName(p.nome) === normalizeName(m.nome)))).length
    const atrasosConfirmados = ocorrencias.filter((o) => o.usuario_id === m.id).length
    const pontualidadePct = escalasNoAno > 0 ? Math.max(0, 1 - atrasosConfirmados / escalasNoAno) : 0
    const totalReconhecimentos = reconhecimentos.filter((r) => r.para_usuario_id === m.id).length
    const reconhecimentoPct = Math.min(1, totalReconhecimentos / 12)
    const ajuste = ajustes.filter((a) => a.usuario_id === m.id).reduce((s, a) => s + a.pontos, 0)

    const pontosBase =
      formacao.percentual * config.peso_formacao +
      liturgia.percentual * config.peso_liturgia +
      pontualidadePct * config.peso_pontualidade +
      reconhecimentoPct * config.peso_reconhecimento

    return {
      posicao: 0,
      usuarioId: m.id,
      nome: m.nome,
      funcao: m.funcao,
      foto: m.foto,
      pontos: Math.max(0, Math.round((pontosBase + ajuste) * 10) / 10),
      formacao: Math.round(formacao.percentual * config.peso_formacao * 10) / 10,
      liturgia: Math.round(liturgia.percentual * config.peso_liturgia * 10) / 10,
      pontualidade: Math.round(pontualidadePct * config.peso_pontualidade * 10) / 10,
      reconhecimento: Math.round(reconhecimentoPct * config.peso_reconhecimento * 10) / 10,
      ajustes: Math.round(ajuste * 10) / 10,
      reconhecimentos: totalReconhecimentos,
      atrasosConfirmados,
      escalasNoAno,
      quizzesRespondidos: formacao.respondidos + liturgia.respondidos,
    }
  })

  linhas.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"))
  linhas.forEach((l, i) => { l.posicao = i + 1 })
  return { config, ranking: linhas }
}
