import { listarMembrosAprovados, listarRespostasQuiz, obterRankingConfig } from "@/lib/db"

export type RankingLinha = {
  posicao: number
  usuarioId: string
  nome: string
  funcao: string | null
  foto?: string | null
  pontos: number
  acertos: number
  quizzesRespondidos: number
  aproveitamento: number
  formacao: number
  liturgia: number
  pontualidade: number
  reconhecimento: number
  ajustes: number
  reconhecimentos: number
  atrasosConfirmados: number
  escalasNoAno: number
}

function participantes() {
  return listarMembrosAprovados()
}

export function calcularRanking(ano: number): { config: ReturnType<typeof obterRankingConfig>; ranking: RankingLinha[] } {
  const prefixoAno = `liturgia-auto:${ano}-`
  const respostas = listarRespostasQuiz().filter((r) => r.quiz_id.startsWith(prefixoAno))
  const config = obterRankingConfig(ano)

  const linhas = participantes().map((usuario) => {
    const minhas = respostas.filter((r) => r.usuario_id === usuario.id)
    const pontos = minhas.reduce((s, r) => s + r.pontos, 0)
    const possivel = minhas.reduce((s, r) => s + r.total_pontos, 0)
    const acertos = minhas.reduce((s, r) => s + r.acertos, 0)
    const aproveitamento = possivel > 0 ? Math.round((pontos / possivel) * 100) : 0
    return {
      posicao: 0,
      usuarioId: usuario.id,
      nome: usuario.nome,
      funcao: usuario.funcao,
      foto: usuario.foto,
      pontos,
      acertos,
      quizzesRespondidos: minhas.length,
      aproveitamento,
      formacao: 0,
      liturgia: pontos,
      pontualidade: 0,
      reconhecimento: 0,
      ajustes: 0,
      reconhecimentos: 0,
      atrasosConfirmados: 0,
      escalasNoAno: 0,
    }
  })

  linhas.sort((a, b) => b.pontos - a.pontos || b.acertos - a.acertos || a.nome.localeCompare(b.nome, "pt-BR"))
  linhas.forEach((l, i) => { l.posicao = i + 1 })
  return { config, ranking: linhas }
}
