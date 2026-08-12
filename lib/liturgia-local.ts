import "server-only"

import fs from "node:fs"
import path from "node:path"

export type LeituraLocal = {
  referencia?: string
  titulo?: string
  texto?: string
  refrao?: string
}

export type LiturgiaLocal = {
  data?: string
  liturgia: string
  liturgiaOriginal?: string
  cor: string
  tempoLiturgicoAtual: string
  tempoCategoria: string
  imagem?: string | null
  santoDoDia?: {
    nome: string
    resumo?: string
    imagem?: string | null
  } | null
  fonte?: {
    nome?: string
    url?: string
    licenca?: string
  }
  oracoes?: {
    coleta?: string
    oferendas?: string
    comunhao?: string
  }
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
    ) {
      console.error(`[Liturgia local] Arquivo inválido: ${arquivo}`)
      return null
    }
    return parsed as LiturgiaLocal
  } catch (error) {
    console.error(`[Liturgia local] Não foi possível ler ${arquivo}:`, error)
    return null
  }
}

export function diretorioLiturgiaLocal() {
  return DIRETORIO
}
