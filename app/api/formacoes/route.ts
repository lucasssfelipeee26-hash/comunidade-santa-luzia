import { NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { lerSessao } from "@/lib/auth"
import {listarFormacoes, salvarFormacao, type FormacaoArquivo, DATA_DIR} from "@/lib/db"

export const runtime = "nodejs"

const UPLOAD_DIR = path.join(DATA_DIR, "formacoes")
const MAX_FILE_SIZE = 20 * 1024 * 1024
const EXTENSOES = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".odt", ".odp", ".txt"])

function dataValida(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) }
function horarioValido(value: string) { return value === "" || /^\d{2}:\d{2}$/.test(value) }
function sanitizar(nome: string) { return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") }

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Faça login para acessar as formações." }, { status: 401 })
  return NextResponse.json({ formacoes: listarFormacoes() })
}

export async function POST(request: Request) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })

  const form = await request.formData()
  const titulo = String(form.get("titulo") || "").trim()
  const tema = String(form.get("tema") || "").trim()
  const data = String(form.get("data") || "").trim()
  const horario = String(form.get("horario") || "").trim()
  const descricao = String(form.get("descricao") || "").trim()
  const status = String(form.get("status") || "agendada") === "cancelada" ? "cancelada" : "agendada"
  const motivo = String(form.get("motivo_cancelamento") || "").trim()
  const file = form.get("arquivo")

  if (titulo.length < 3 || tema.length < 3) return NextResponse.json({ erro: "Informe o título e o tema da formação." }, { status: 400 })
  if (!dataValida(data) || !horarioValido(horario)) return NextResponse.json({ erro: "Data ou horário inválido." }, { status: 400 })
  if (status === "cancelada" && motivo.length < 3) return NextResponse.json({ erro: "Informe o motivo do cancelamento." }, { status: 400 })

  let arquivo: FormacaoArquivo | null = null
  if (file instanceof File && file.size > 0) {
    const ext = path.extname(file.name).toLowerCase()
    if (!EXTENSOES.has(ext)) return NextResponse.json({ erro: "Tipo de arquivo não permitido. Use PDF, PowerPoint, Word, ODT/ODP ou TXT." }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ erro: "O arquivo deve ter no máximo 20 MB." }, { status: 400 })
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizar(file.name)}`
    fs.writeFileSync(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()))
    arquivo = { nome_original: file.name, nome_armazenado: stored, mime: file.type || "application/octet-stream", tamanho: file.size }
  }

  const row = salvarFormacao({ titulo, tema, data, horario: horario || null, descricao, status, motivo_cancelamento: status === "cancelada" ? motivo : null, arquivo })
  return NextResponse.json({ formacao: row }, { status: 201 })
}
