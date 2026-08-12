import "server-only"

import { listarQuizzes, salvarQuiz, type QuizPergunta } from "@/lib/db"
import { obterLiturgiaLocal } from "@/lib/liturgia-local"

function opcoes(correta: string, outras: string[], giro: number) {
  const base = [correta, ...outras.filter((x) => x && x !== correta)].slice(0, 3)
  while (base.length < 3) base.push(base.length === 1 ? "Não consta na Liturgia de hoje" : "Outra referência")
  const n = giro % 3
  const itens = [...base.slice(n), ...base.slice(0, n)]
  return { itens, correta: itens.indexOf(correta) }
}

export function garantirQuizLiturgiaOffline(dataIso: string) {
  const liturgia = obterLiturgiaLocal(dataIso)
  if (!liturgia) return null

  const existente = listarQuizzes(true).find((q) =>
    q.origem === "liturgia" &&
    q.data_referencia === dataIso &&
    q.referencia_id === `liturgia-offline:${dataIso}`,
  )
  if (existente) return existente

  const primeira = liturgia.leituras.primeiraLeitura?.[0]
  const salmo = liturgia.leituras.salmo?.[0]
  const segunda = liturgia.leituras.segundaLeitura?.[0]
  const evangelho = liturgia.leituras.evangelho?.[0]
  const referencias = [primeira?.referencia, salmo?.referencia, segunda?.referencia, evangelho?.referencia].filter(Boolean) as string[]
  const perguntas: QuizPergunta[] = []

  if (primeira?.referencia) {
    const o = opcoes(primeira.referencia, referencias.filter((x) => x !== primeira.referencia), 1)
    perguntas.push({ id: "lit-1", enunciado: "Qual é a referência da Primeira Leitura da Liturgia de hoje?", opcoes: o.itens, correta: o.correta, pontos: 10, explicacao: `A Primeira Leitura é ${primeira.referencia}.` })
  }
  if (salmo?.referencia) {
    const o = opcoes(salmo.referencia, referencias.filter((x) => x !== salmo.referencia), 2)
    perguntas.push({ id: "lit-2", enunciado: "Qual é a referência do Salmo Responsorial de hoje?", opcoes: o.itens, correta: o.correta, pontos: 10, explicacao: `O Salmo Responsorial é ${salmo.referencia}.` })
  }
  if (salmo?.refrao) {
    const o = opcoes(salmo.refrao, ["O Senhor é meu pastor e nada me faltará.", "Provai e vede como o Senhor é bom."], 1)
    perguntas.push({ id: "lit-3", enunciado: "Qual é o refrão do Salmo Responsorial apresentado na Liturgia de hoje?", opcoes: o.itens, correta: o.correta, pontos: 15, explicacao: `Refrão: ${salmo.refrao}` })
  }
  if (evangelho?.referencia) {
    const o = opcoes(evangelho.referencia, referencias.filter((x) => x !== evangelho.referencia), 0)
    perguntas.push({ id: "lit-4", enunciado: "Qual é a referência do Evangelho proclamado hoje?", opcoes: o.itens, correta: o.correta, pontos: 15, explicacao: `O Evangelho é ${evangelho.referencia}.` })
  }

  const periodo = opcoes(liturgia.tempoLiturgicoAtual, ["Tempo do Advento", "Tempo Pascal"], 2)
  perguntas.push({ id: "lit-5", enunciado: "Em qual período litúrgico está inserida a celebração de hoje?", opcoes: periodo.itens, correta: periodo.correta, pontos: 10, explicacao: liturgia.tempoLiturgicoAtual })

  if (perguntas.length < 3) return null

  return salvarQuiz({
    titulo: `Quiz da Liturgia — ${dataIso.split("-").reverse().join("/")}`,
    descricao: "Gerado automaticamente e exclusivamente a partir da mesma base offline exibida na Central de Liturgia.",
    origem: "liturgia",
    referencia_id: `liturgia-offline:${dataIso}`,
    data_referencia: dataIso,
    ativo: true,
    perguntas,
    criado_por: "sistema-liturgia-offline",
  })
}
