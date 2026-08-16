import fs from "node:fs"
import path from "node:path"
import { DATA_DIR } from "@/lib/db"

type PerfilPublicoExtra = {
  bio: string
  atualizado_em: number
}

type PerfisPublicosStore = Record<string, PerfilPublicoExtra>

const ARQUIVO = path.join(DATA_DIR, "perfis-publicos.json")

function ler(): PerfisPublicosStore {
  try {
    if (!fs.existsSync(ARQUIVO)) return {}
    const parsed = JSON.parse(fs.readFileSync(ARQUIVO, "utf8")) as PerfisPublicosStore
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function salvar(store: PerfisPublicosStore) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const temp = `${ARQUIVO}.tmp`
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), "utf8")
  fs.renameSync(temp, ARQUIVO)
}

export function obterBioPublica(usuarioId: string) {
  return String(ler()[usuarioId]?.bio || "")
}

export function salvarBioPublica(usuarioId: string, bio: string) {
  const store = ler()
  const normalizada = String(bio || "").trim().slice(0, 280)
  if (normalizada) {
    store[usuarioId] = { bio: normalizada, atualizado_em: Date.now() }
  } else {
    delete store[usuarioId]
  }
  salvar(store)
  return normalizada
}
