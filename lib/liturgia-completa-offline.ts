import "server-only"

import fs from "node:fs"
import path from "node:path"
import type { LiturgiaLocal } from "@/lib/liturgia-local"

type PacoteMensal = { ano: number; mes: number; dias: Record<string, LiturgiaLocal> }
const cache = new Map<string, PacoteMensal | null>()
const DIRETORIO = path.join(process.cwd(), "public", "offline", "liturgia-completa")

function carregarMes(dataIso: string) {
  const chave = dataIso.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(chave)) return null
  if (cache.has(chave)) return cache.get(chave) || null
  const arquivo = path.join(DIRETORIO, `${chave}.json`)
  try {
    if (!fs.existsSync(arquivo)) { cache.set(chave, null); return null }
    const pacote = JSON.parse(fs.readFileSync(arquivo, "utf8")) as PacoteMensal
    if (!pacote?.dias || typeof pacote.dias !== "object") { cache.set(chave, null); return null }
    cache.set(chave, pacote)
    return pacote
  } catch (error) {
    console.error(`[Liturgia offline] Não foi possível carregar ${chave}:`, error)
    cache.set(chave, null)
    return null
  }
}

export function obterLiturgiaCompletaOffline(dataIso: string): LiturgiaLocal | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null
  const dia = carregarMes(dataIso)?.dias?.[dataIso]
  if (!dia?.liturgia || !dia?.leituras?.primeiraLeitura?.length || !dia?.leituras?.evangelho?.length) return null
  return dia
}
