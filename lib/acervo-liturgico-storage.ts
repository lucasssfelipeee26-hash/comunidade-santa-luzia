import "server-only"

import fs from "node:fs"
import path from "node:path"
import { DATA_DIR } from "@/lib/db"

export const ACERVO_DIR = path.join(DATA_DIR, "acervo-liturgico")

export function garantirDiretorioAcervo() {
  fs.mkdirSync(ACERVO_DIR, { recursive: true })
}

export function nomeArquivoAcervoValido(nome: string) {
  return nome === "manifest.json" || /^[a-z0-9-]+\.json\.gz$/i.test(nome)
}

export function caminhoArquivoAcervo(nome: string) {
  if (!nomeArquivoAcervoValido(nome)) return null
  const resolvido = path.resolve(ACERVO_DIR, nome)
  if (!resolvido.startsWith(path.resolve(ACERVO_DIR) + path.sep)) return null
  return resolvido
}

export function lerManifestoAcervo() {
  garantirDiretorioAcervo()
  const arquivo = caminhoArquivoAcervo("manifest.json")!
  if (!fs.existsSync(arquivo)) return null
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

export function statusAcervo() {
  const manifesto = lerManifestoAcervo()
  if (!manifesto) return { instalado: false, total: 0, categorias: 0 }
  const categorias = Array.isArray(manifesto.categorias) ? manifesto.categorias : []
  return {
    instalado: true,
    total: Number(manifesto.total) || 0,
    categorias: categorias.length,
    versao: Number(manifesto.version) || 1,
  }
}

export function instalarTarAcervo(buffer: Buffer) {
  garantirDiretorioAcervo()
  const temporario = path.join(DATA_DIR, `acervo-liturgico-${Date.now()}`)
  fs.mkdirSync(temporario, { recursive: true })
  const escritos: string[] = []

  try {
    let offset = 0
    while (offset + 512 <= buffer.length) {
      const header = buffer.subarray(offset, offset + 512)
      if (header.every((b) => b === 0)) break
      const nome = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "").trim()
      const tamanhoTexto = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim()
      const tamanho = parseInt(tamanhoTexto || "0", 8)
      const tipo = header[156]
      offset += 512

      if (tipo === 0 || tipo === 48) {
        const basename = path.basename(nome)
        if (nomeArquivoAcervoValido(basename) && tamanho >= 0 && offset + tamanho <= buffer.length) {
          const conteudo = buffer.subarray(offset, offset + tamanho)
          fs.writeFileSync(path.join(temporario, basename), conteudo)
          escritos.push(basename)
        }
      }
      offset += Math.ceil(tamanho / 512) * 512
    }

    if (!escritos.includes("manifest.json")) throw new Error("O pacote não contém manifest.json.")
    const manifesto = JSON.parse(fs.readFileSync(path.join(temporario, "manifest.json"), "utf8")) as { total?: number; categorias?: unknown[] }
    if (!Number(manifesto.total) || !Array.isArray(manifesto.categorias)) throw new Error("Manifesto do acervo inválido.")

    for (const nome of escritos) {
      fs.copyFileSync(path.join(temporario, nome), path.join(ACERVO_DIR, nome))
    }

    return { ...statusAcervo(), arquivos: escritos.length }
  } finally {
    fs.rmSync(temporario, { recursive: true, force: true })
  }
}
