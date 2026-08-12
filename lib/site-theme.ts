import "server-only"

import fs from "node:fs"
import path from "node:path"
import { TEMA_PADRAO, temaValido, type TemaSite } from "@/lib/site-theme-shared"

import { DATA_DIR } from "@/lib/db"
const CONFIG_PATH = path.join(DATA_DIR, "configuracao-site.json")

type ConfiguracaoSite = {
  tema?: TemaSite
  atualizado_em?: number
}

let cacheConfiguracao: ConfiguracaoSite | null = null
let cacheMtimeMs = -1

function garantirPasta() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function lerConfiguracao(): ConfiguracaoSite {
  garantirPasta()
  if (!fs.existsSync(CONFIG_PATH)) {
    cacheConfiguracao = {}
    cacheMtimeMs = 0
    return cacheConfiguracao
  }

  try {
    const mtimeMs = fs.statSync(CONFIG_PATH).mtimeMs
    if (cacheConfiguracao && cacheMtimeMs === mtimeMs) return cacheConfiguracao

    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as ConfiguracaoSite
    cacheConfiguracao = parsed && typeof parsed === "object" ? parsed : {}
    cacheMtimeMs = mtimeMs
    return cacheConfiguracao
  } catch {
    return cacheConfiguracao || {}
  }
}

export function lerTemaSite(): TemaSite {
  const config = lerConfiguracao()
  return temaValido(config.tema) ? config.tema : TEMA_PADRAO
}

export function salvarTemaSite(tema: TemaSite) {
  garantirPasta()
  const atual = lerConfiguracao()
  const novo: ConfiguracaoSite = {
    ...atual,
    tema,
    atualizado_em: Date.now(),
  }

  const temporario = `${CONFIG_PATH}.tmp`
  fs.writeFileSync(temporario, JSON.stringify(novo, null, 2), "utf8")
  fs.renameSync(temporario, CONFIG_PATH)

  cacheConfiguracao = novo
  try {
    cacheMtimeMs = fs.statSync(CONFIG_PATH).mtimeMs
  } catch {
    cacheMtimeMs = -1
  }

  return novo
}

export function obterRevisaoTemaSite() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return "tema-padrao"
    const stat = fs.statSync(CONFIG_PATH)
    return `${Math.trunc(stat.mtimeMs)}-${stat.size}`
  } catch {
    return "tema-indisponivel"
  }
}
