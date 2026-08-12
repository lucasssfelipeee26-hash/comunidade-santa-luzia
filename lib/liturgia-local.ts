import "server-only"

import fs from "node:fs"
import path from "node:path"

export type LeituraLocal = { referencia?: string; titulo?: string; texto?: string; refrao?: string }

export type LiturgiaLocal = {
  data?: string
  liturgia: string
  liturgiaOriginal?: string
  cor: string
  tempoLiturgicoAtual: string
  tempoCategoria: string
  imagem?: string | null
  santoDoDia?: { nome: string; resumo?: string; imagem?: string | null } | null
  fonte?: { nome?: string; licenca?: string; arquivoOrigem?: string }
  oracoes?: { coleta?: string; oferendas?: string; comunhao?: string }
  leituras: {
    primeiraLeitura?: LeituraLocal[]
    salmo?: LeituraLocal[]
    segundaLeitura?: LeituraLocal[]
    evangelho?: LeituraLocal[]
  }
}

const DIRETORIO = process.env.LITURGIA_LOCAL_DIR?.trim()
  ? path.resolve(process.env.LITURGIA_LOCAL_DIR.trim())
  : path.join(process.cwd(), "content", "liturgia", "dias")

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

function arquivoDoDia(dataIso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null
  return path.join(DIRETORIO, `${dataIso}.json`)
}

export function obterLiturgiaLocal(dataIso: string): LiturgiaLocal | null {
  const arquivo = arquivoDoDia(dataIso)
  if (!arquivo || !fs.existsSync(arquivo)) return null

  try {
    const parsed = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Partial<LiturgiaLocal>
    if (
      typeof parsed.liturgia !== "string" || !parsed.liturgia.trim() ||
      typeof parsed.cor !== "string" ||
      typeof parsed.tempoLiturgicoAtual !== "string" ||
      typeof parsed.tempoCategoria !== "string" ||
      !parsed.leituras || typeof parsed.leituras !== "object"
    ) return null
    return parsed as LiturgiaLocal
  } catch (error) {
    console.error(`[Liturgia offline] Não foi possível ler ${arquivo}:`, error)
    return null
  }
}

export function temLiturgiaLocal(dataIso: string) { return Boolean(obterLiturgiaLocal(dataIso)) }
export function diretorioLiturgiaLocal() { return DIRETORIO }
