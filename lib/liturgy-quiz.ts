import { createHash } from "node:crypto"

type Leitura = { referencia?: string; texto?: string; refrao?: string }
export type LiturgiaQuizFonte = {
  liturgia: string
  cor: string
  tempoLiturgicoAtual: string
  santoDoDia?: { nome: string } | null
  leituras: {
    primeiraLeitura?: Leitura[]
    salmo?: Leitura[]
    segundaLeitura?: Leitura[]
    evangelho?: Leitura[]
  }
}

export type PerguntaQuizLiturgia = {
  id: string
  enunciado: string
  opcoes: string[]
  correta: number
  pontos: number
}

function hashNumero(seed: string, chave: string) {
  const hex = createHash("sha256").update(`${seed}:${chave}`).digest("hex").slice(0, 12)
  return Number.parseInt(hex, 16)
}

function unicos(valores: Array<string | undefined | null>) {
  return [...new Set(valores.map((v) => String(v || "").trim()).filter(Boolean))]
}

function embaralhar<T>(lista: T[], seed: string, chave: string) {
  return [...lista]
    .map((valor, i) => ({ valor, ordem: hashNumero(seed, `${chave}:${i}`) }))
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => item.valor)
}

function montarPergunta(id: string, enunciado: string, correta: string, distratores: string[], seed: string): PerguntaQuizLiturgia | null {
  const opcoesBase = unicos([correta, ...distratores]).slice(0, 3)
  if (!correta || opcoesBase.length < 3) return null
  const opcoes = embaralhar(opcoesBase, seed, id)
  return { id, enunciado, opcoes, correta: opcoes.indexOf(correta), pontos: 20 }
}

export function gerarQuizLiturgia(fonte: LiturgiaQuizFonte, seed: string) {
  const primeira = fonte.leituras.primeiraLeitura?.[0]?.referencia
  const segunda = fonte.leituras.segundaLeitura?.[0]?.referencia
  const evangelho = fonte.leituras.evangelho?.[0]?.referencia
  const salmo = fonte.leituras.salmo?.[0]?.referencia
  const referencias = unicos([primeira, segunda, evangelho, salmo])
  const perguntas: Array<PerguntaQuizLiturgia | null> = []

  if (fonte.cor) perguntas.push(montarPergunta("cor", "Qual é a cor litúrgica indicada para hoje?", fonte.cor, ["Verde", "Branco", "Vermelho", "Roxo", "Rosa"].filter((c) => c.toLowerCase() !== fonte.cor.toLowerCase()), seed))
  if (fonte.tempoLiturgicoAtual) perguntas.push(montarPergunta("tempo", "Qual é o tempo litúrgico indicado na Liturgia de hoje?", fonte.tempoLiturgicoAtual, ["Tempo Comum", "Advento", "Quaresma", "Tempo Pascal", "Tempo do Natal"].filter((t) => t !== fonte.tempoLiturgicoAtual), seed))
  if (evangelho) perguntas.push(montarPergunta("evangelho", "Qual é a referência do Evangelho proclamado hoje?", evangelho, referencias.filter((r) => r !== evangelho).concat(["Jo 1,1-5", "Mt 5,1-12"]), seed))
  if (primeira) perguntas.push(montarPergunta("primeira", "Qual é a referência da Primeira Leitura de hoje?", primeira, referencias.filter((r) => r !== primeira).concat(["Gn 1,1-5", "At 2,1-4"]), seed))
  if (fonte.santoDoDia?.nome) perguntas.push(montarPergunta("santo", "Quem é apresentado como Santo do Dia?", fonte.santoDoDia.nome, ["São Tarcísio", "Santa Teresinha do Menino Jesus", "São Padre Pio"], seed))
  else if (fonte.liturgia) perguntas.push(montarPergunta("celebracao", "Como a celebração de hoje é apresentada na Liturgia?", fonte.liturgia, ["Liturgia do Dia", "Memória litúrgica", "Festa litúrgica", "Solenidade", "Domingo"].filter((v) => v !== fonte.liturgia), seed))

  const validas = perguntas.filter((p): p is PerguntaQuizLiturgia => Boolean(p))
  return embaralhar(validas, seed, "ordem-perguntas").slice(0, 5)
}
