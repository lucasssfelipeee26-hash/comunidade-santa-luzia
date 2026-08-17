import { createHash, randomBytes } from "node:crypto"
import { SignJWT, jwtVerify } from "jose"
import type { QuizPergunta } from "@/lib/db"
import { normalizarReferenciaBiblica } from "@/lib/referencia-biblica"

export type LeituraQuiz = {
  referencia?: string
  texto?: string
  refrao?: string
}

export type LiturgiaQuizPayload = {
  cor?: string
  liturgia?: string
  tempoLiturgicoAtual?: string
  santoDoDia?: { nome?: string } | null
  leituras?: {
    primeiraLeitura?: LeituraQuiz[]
    salmo?: LeituraQuiz[]
    segundaLeitura?: LeituraQuiz[]
    evangelho?: LeituraQuiz[]
  }
}

type TentativaPayload = {
  uid: string
  data: string
  nonce: string
  expiraEm: number
}

function secret() {
  const value = process.env.AUTH_SECRET?.trim()
  if (!value) throw new Error("AUTH_SECRET não configurado para o Quiz Litúrgico.")
  return new TextEncoder().encode(value)
}

export function dataCuiabaIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function quizDiarioId(data: string) {
  return `liturgia-auto:${data}`
}

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function unicos(values: Array<string | undefined | null>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = String(raw || "").replace(/\s+/g, " ").trim()
    if (!value) continue
    const key = normalizar(value)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function score(seed: string) {
  return createHash("sha256").update(seed).digest().readUInt32BE(0)
}

function embaralhar<T>(items: T[], seed: string) {
  return items
    .map((item, index) => ({ item, n: score(`${seed}:${index}:${String(item)}`) }))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.item)
}

function trecho(texto?: string) {
  const linhas = String(texto || "")
    .split(/\n+/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => x.length >= 30)
  const escolhido = linhas.find((x) => !/Palavra da Salvação|Glória a vós|Palavra do Senhor/i.test(x)) || linhas[0] || ""
  return escolhido.length > 130 ? `${escolhido.slice(0, 127).trim()}…` : escolhido
}

function pergunta(
  id: string,
  enunciado: string,
  correta: string,
  alternativas: string[],
  seed: string,
): QuizPergunta | null {
  const opcoesBase = unicos([correta, ...alternativas])
  if (!correta || opcoesBase.length < 3) return null
  const opcoes = embaralhar(opcoesBase.slice(0, 3), `${seed}:${id}`)
  const corretaIndex = opcoes.findIndex((x) => normalizar(x) === normalizar(correta))
  if (corretaIndex < 0) return null
  return {
    id,
    enunciado,
    opcoes,
    correta: corretaIndex,
    pontos: 10,
  }
}

export function gerarPerguntasLiturgia(liturgia: LiturgiaQuizPayload, seed: string) {
  const leituras = liturgia.leituras || {}
  const primeira = leituras.primeiraLeitura?.[0]
  const salmo = leituras.salmo?.[0]
  const segunda = leituras.segundaLeitura?.[0]
  const evangelho = leituras.evangelho?.[0]

  const referenciaPrimeira = normalizarReferenciaBiblica(primeira?.referencia)
  const referenciaSalmo = normalizarReferenciaBiblica(salmo?.referencia)
  const referenciaSegunda = normalizarReferenciaBiblica(segunda?.referencia)
  const referenciaEvangelho = normalizarReferenciaBiblica(evangelho?.referencia)
  const referencias = unicos([
    referenciaEvangelho,
    referenciaPrimeira,
    referenciaSegunda,
    referenciaSalmo,
  ])

  const cores = ["Branco", "Verde", "Roxo", "Vermelho", "Rosa"]
  const tempos = ["Advento", "Quaresma", "Tempo Comum", "Tempo Pascal", "Tempo do Natal", "Tríduo Pascal"]
  const cor = String(liturgia.cor || "").replace(/^Cor Litúrgica:\s*/i, "").trim()
  const tempo = String(liturgia.tempoLiturgicoAtual || "").trim()

  const candidatos: Array<QuizPergunta | null> = [
    pergunta(
      "cor-liturgica",
      "Qual é a cor litúrgica indicada para a celebração de hoje?",
      cor,
      cores.filter((x) => normalizar(x) !== normalizar(cor)),
      seed,
    ),
    pergunta(
      "tempo-liturgico",
      "Qual tempo litúrgico aparece na Liturgia de hoje?",
      tempo,
      tempos.filter((x) => !normalizar(tempo).includes(normalizar(x)) && !normalizar(x).includes(normalizar(tempo))),
      seed,
    ),
    pergunta(
      "referencia-evangelho",
      "Qual destas referências corresponde ao Evangelho de hoje?",
      referenciaEvangelho,
      referencias.filter((x) => normalizar(x) !== normalizar(referenciaEvangelho)),
      seed,
    ),
    pergunta(
      "referencia-primeira",
      "Qual destas referências corresponde à Primeira Leitura de hoje?",
      referenciaPrimeira,
      referencias.filter((x) => normalizar(x) !== normalizar(referenciaPrimeira)),
      seed,
    ),
    pergunta(
      "trecho-evangelho",
      "Qual destes trechos pertence ao Evangelho de hoje?",
      trecho(evangelho?.texto),
      [trecho(primeira?.texto), trecho(segunda?.texto), trecho(salmo?.texto)],
      seed,
    ),
    pergunta(
      "refrao-salmo",
      "Qual é o refrão apresentado no Salmo Responsorial de hoje?",
      salmo?.refrao || "",
      [trecho(primeira?.texto), trecho(evangelho?.texto), trecho(segunda?.texto)],
      seed,
    ),
  ]

  const validas = candidatos.filter((p): p is QuizPergunta => Boolean(p))
  return embaralhar(validas, `${seed}:ordem`).slice(0, 5)
}

export async function criarTentativa(usuarioId: string) {
  const data = dataCuiabaIso()
  const nonce = randomBytes(12).toString("hex")
  const expiraEm = Date.now() + 90_000
  const token = await new SignJWT({ uid: usuarioId, data, nonce, expiraEm, tipo: "quiz-liturgia" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.ceil(expiraEm / 1000) + 5)
    .sign(secret())
  return { token, data, nonce, expiraEm, duracaoSegundos: 90 }
}

export async function validarTentativa(token: string, usuarioId: string): Promise<TentativaPayload> {
  const { payload } = await jwtVerify(token, secret())
  if (
    payload.tipo !== "quiz-liturgia" ||
    payload.uid !== usuarioId ||
    typeof payload.data !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.expiraEm !== "number"
  ) {
    throw new Error("Tentativa inválida.")
  }
  if (Date.now() > payload.expiraEm) throw new Error("O tempo desta tentativa terminou.")
  if (payload.data !== dataCuiabaIso()) throw new Error("Esta tentativa não pertence à Liturgia de hoje.")
  return {
    uid: usuarioId,
    data: payload.data,
    nonce: payload.nonce,
    expiraEm: payload.expiraEm,
  }
}
