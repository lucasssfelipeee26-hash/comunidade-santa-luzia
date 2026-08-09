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

function garantirPasta() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function lerConfiguracao(): ConfiguracaoSite {
  garantirPasta()
  if (!fs.existsSync(CONFIG_PATH)) return {}

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as ConfiguracaoSite
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
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

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(novo, null, 2), "utf8")
  return novo
}
