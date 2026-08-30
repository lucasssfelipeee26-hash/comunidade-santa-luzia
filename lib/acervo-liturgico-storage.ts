import "server-only"

import fs from "node:fs"
import path from "node:path"
import { DATA_DIR } from "@/lib/db"

export const ACERVO_DIR = path.join(DATA_DIR, "acervo-liturgico")
export const ACERVO_EMBUTIDO_DIR = process.cwd()

type CategoriaManifesto = { id?: unknown; nome?: unknown; total?: unknown; arquivos?: unknown }
type ManifestoAcervo = {
  version?: unknown
  offline?: unknown
  embedded?: unknown
  htmlPreservado?: unknown
  imagensImportadas?: unknown
  total?: unknown
  origem?: unknown
  categorias?: unknown
}

const MANIFESTO_EMBUTIDO = {
  version: 2,
  offline: true,
  embedded: true,
  htmlPreservado: true,
  imagensImportadas: false,
  total: 5434,
  origem: "Acervo litúrgico autorizado incorporado ao aplicativo",
  categorias: [
    { id: "catequeses", nome: "Catequeses", total: 56, arquivos: ["catequeses.html.json.gz"] },
    { id: "comentarios", nome: "Comentários", total: 25, arquivos: ["comentarios.html.json.gz"] },
    { id: "evangelho", nome: "Evangelhos e Lectio Divina", total: 469, arquivos: ["evangelhos.html.json.gz"] },
    { id: "geral", nome: "Documentos gerais", total: 7, arquivos: ["gerais.html.json.gz"] },
    { id: "lecionario", nome: "Lecionário", total: 736, arquivos: ["lecionario.html.json.gz"] },
    { id: "missal", nome: "Missal e ritos", total: 387, arquivos: ["missal.html.json.gz"] },
    { id: "oficio", nome: "Liturgia das Horas / Ofício", total: 3749, arquivos: Array.from({ length: 10 }, (_, i) => `oficio-${String(i + 1).padStart(2, "0")}.html.json.gz`) },
    { id: "rosario", nome: "Santo Rosário", total: 4, arquivos: ["rosario.html.json.gz"] },
    { id: "salterio", nome: "Saltério", total: 1, arquivos: ["salterio.html.json.gz"] },
  ],
}

export function garantirDiretorioAcervo() {
  fs.mkdirSync(ACERVO_DIR, { recursive: true })
}

export function nomeArquivoAcervoValido(nome: string) {
  return nome === "manifest.json" || /^[a-z0-9.-]+\.json\.gz$/i.test(nome)
}

function arquivosDoManifesto(manifesto: ManifestoAcervo): string[] | null {
  if (!Number(manifesto.total) || !Array.isArray(manifesto.categorias) || manifesto.categorias.length === 0) return null
  const arquivos = new Set<string>()
  for (const item of manifesto.categorias as CategoriaManifesto[]) {
    if (!item || typeof item !== "object" || !Array.isArray(item.arquivos) || item.arquivos.length === 0) return null
    for (const bruto of item.arquivos) {
      if (typeof bruto !== "string") return null
      const nome = path.basename(bruto)
      if (nome !== bruto || nome === "manifest.json" || !nomeArquivoAcervoValido(nome)) return null
      arquivos.add(nome)
    }
  }
  return [...arquivos]
}

function lerManifestoPersistenteValido(): ManifestoAcervo | null {
  garantirDiretorioAcervo()
  const arquivo = path.join(ACERVO_DIR, "manifest.json")
  if (!fs.existsSync(arquivo)) return null
  try {
    const manifesto = JSON.parse(fs.readFileSync(arquivo, "utf8")) as ManifestoAcervo
    const arquivos = arquivosDoManifesto(manifesto)
    if (!arquivos || arquivos.some((nome) => !fs.existsSync(path.join(ACERVO_DIR, nome)))) return null
    return manifesto
  } catch {
    return null
  }
}

export function caminhoArquivoAcervo(nome: string) {
  if (!nomeArquivoAcervoValido(nome)) return null

  // Um pacote instalado e validado pelo moderador substitui o embutido de forma atômica.
  const persistenteManifesto = lerManifestoPersistenteValido()
  if (persistenteManifesto) {
    const persistente = path.resolve(ACERVO_DIR, nome)
    if (persistente.startsWith(path.resolve(ACERVO_DIR) + path.sep) && fs.existsSync(persistente)) return persistente
  }

  // Sem pacote persistente válido, o acervo incorporado continua sendo o fallback seguro.
  const embutido = path.resolve(ACERVO_EMBUTIDO_DIR, nome)
  if (nome !== "manifest.json" && embutido.startsWith(path.resolve(ACERVO_EMBUTIDO_DIR) + path.sep) && fs.existsSync(embutido)) {
    return embutido
  }

  const persistente = path.resolve(ACERVO_DIR, nome)
  if (!persistente.startsWith(path.resolve(ACERVO_DIR) + path.sep)) return null
  return fs.existsSync(persistente) ? persistente : null
}

export function lerManifestoAcervo() {
  // Instalação administrativa válida tem precedência; o embutido é sempre o fallback.
  const persistente = lerManifestoPersistenteValido()
  if (persistente) return persistente

  if (fs.existsSync(path.join(ACERVO_EMBUTIDO_DIR, "lecionario.html.json.gz")) && fs.existsSync(path.join(ACERVO_EMBUTIDO_DIR, "oficio-01.html.json.gz"))) {
    return MANIFESTO_EMBUTIDO
  }

  return null
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
        if (nome === basename && nomeArquivoAcervoValido(basename) && tamanho >= 0 && offset + tamanho <= buffer.length) {
          const conteudo = buffer.subarray(offset, offset + tamanho)
          fs.writeFileSync(path.join(temporario, basename), conteudo)
          escritos.push(basename)
        }
      }
      offset += Math.ceil(tamanho / 512) * 512
    }

    if (!escritos.includes("manifest.json")) throw new Error("O pacote não contém manifest.json.")
    const manifesto = JSON.parse(fs.readFileSync(path.join(temporario, "manifest.json"), "utf8")) as ManifestoAcervo
    const arquivosEsperados = arquivosDoManifesto(manifesto)
    if (!arquivosEsperados) throw new Error("Manifesto do acervo inválido.")
    const faltantes = arquivosEsperados.filter((nome) => !escritos.includes(nome) || !fs.existsSync(path.join(temporario, nome)))
    if (faltantes.length > 0) throw new Error(`Pacote incompleto. Arquivos ausentes: ${faltantes.slice(0, 4).join(", ")}${faltantes.length > 4 ? "…" : ""}`)

    // Copia primeiro os pacotes e o manifesto por último: leitores nunca observam uma versão nova incompleta.
    for (const nome of escritos.filter((item) => item !== "manifest.json")) {
      fs.copyFileSync(path.join(temporario, nome), path.join(ACERVO_DIR, nome))
    }
    fs.copyFileSync(path.join(temporario, "manifest.json"), path.join(ACERVO_DIR, "manifest.json"))

    return { ...statusAcervo(), arquivos: escritos.length }
  } finally {
    fs.rmSync(temporario, { recursive: true, force: true })
  }
}
