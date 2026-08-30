import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { lerSessao } from "@/lib/auth"
import { atualizarFormacao, listarEquipeAprovada, listarFormacoes, listarHistoricoFormacaoUsuario, listarPresencasFormacao, salvarFormacao, type FormacaoArquivo, type FormacaoRow, DATA_DIR } from "@/lib/db"
import { salvarNotificacao } from "@/lib/notificacoes"
import { dataCivilIsoValida, horario24hValido } from "@/lib/validation"

export const runtime = "nodejs"

const UPLOAD_DIR = path.join(DATA_DIR, "formacoes")
const MAX_FILE_SIZE = 20 * 1024 * 1024
const EXTENSOES = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".odt", ".odp", ".txt"])

type FormacaoIdempotente = FormacaoRow & {
  client_request_id?: string | null
  client_request_fingerprint?: string | null
  criado_por?: string | null
}

function sanitizar(nome: string) { return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-180) || "arquivo" }

function formacaoPublica(formacao: FormacaoIdempotente) {
  const { client_request_id: _requestId, client_request_fingerprint: _fingerprint, criado_por: _criadoPor, ...publica } = formacao
  return publica
}

function fingerprintFormacao(valor: {
  titulo: string
  tema: string
  data: string
  horario: string
  descricao: string
  status: string
  motivo: string
  arquivoNome: string
  arquivoMime: string
  arquivoTamanho: number
  arquivoHash: string
}) {
  return createHash("sha256").update(JSON.stringify(valor)).digest("hex")
}

export async function GET(request: NextRequest) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Faça login para acessar as formações." }, { status: 401 })

  const windowsBeta = request.headers.get("user-agent")?.includes("SantaLuziaWindowsBeta/") || request.headers.get("x-santa-luzia-windows-beta") === "1"
  if (windowsBeta && sessao.tipo === "moderador") {
    const agora = new Date()
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(agora)
    const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Cuiaba", hour: "2-digit", hourCycle: "h23" }).format(agora))
    const totalEquipe = listarEquipeAprovada().length
    for (const formacao of listarFormacoes().filter((item) => item.status === "agendada")) {
      const registros = listarPresencasFormacao(formacao.id)
      const completa = totalEquipe > 0 && registros.length >= totalEquipe
      const prazoEncerrado = formacao.data < hoje || (formacao.data === hoje && hora >= 22)
      if (!completa && prazoEncerrado) salvarNotificacao({ usuario_id: sessao.sub, chave: `formacao-pendente:${formacao.id}`, tipo: "sistema", titulo: "Formação encerrada com registros pendentes", mensagem: `${formacao.titulo}: confira quem ficou sem presença, falta ou justificativa.`, href: "/area-restrita/moderador/formacao" })
      if (completa || prazoEncerrado) atualizarFormacao(formacao.id, { status: "concluida" })
    }
  }
  const historico = new Map(
    listarHistoricoFormacaoUsuario(sessao.sub).map((presenca) => [presenca.formacao_id, presenca]),
  )
  const formacoes = (listarFormacoes() as FormacaoIdempotente[]).map((formacaoInterna) => {
    const formacao = formacaoPublica(formacaoInterna)
    const presenca = historico.get(formacao.id)
    return {
      ...formacao,
      minha_presenca: presenca
        ? {
            status: presenca.status,
            justificativa: presenca.justificativa,
            atualizado_em: presenca.atualizado_em,
          }
        : null,
    }
  })

  return NextResponse.json(
    { formacoes, usuarioId: sessao.sub, tipoUsuario: sessao.tipo },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}

export async function POST(request: Request) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })

  const contentType = request.headers.get("content-type") || ""
  let titulo = ""
  let tema = ""
  let data = ""
  let horario = ""
  let descricao = ""
  let status = "agendada"
  let motivo = ""
  let clientRequestId = ""
  let file: File | null = null

  if (contentType.toLowerCase().includes("application/json")) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ erro: "Não foi possível ler os dados da formação." }, { status: 400 })
    titulo = String(body.titulo || "").trim().replace(/\s+/g, " ")
    tema = String(body.tema || "").trim().replace(/\s+/g, " ")
    data = String(body.data || "").trim()
    horario = String(body.horario || "").trim()
    descricao = String(body.descricao || "").trim()
    status = String(body.status || "agendada") === "cancelada" ? "cancelada" : "agendada"
    motivo = String(body.motivo_cancelamento || "").trim()
    clientRequestId = String(body.clientRequestId || "").trim()
  } else {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ erro: "Não foi possível ler os dados da formação." }, { status: 400 })
    }
    titulo = String(form.get("titulo") || "").trim().replace(/\s+/g, " ")
    tema = String(form.get("tema") || "").trim().replace(/\s+/g, " ")
    data = String(form.get("data") || "").trim()
    horario = String(form.get("horario") || "").trim()
    descricao = String(form.get("descricao") || "").trim()
    status = String(form.get("status") || "agendada") === "cancelada" ? "cancelada" : "agendada"
    motivo = String(form.get("motivo_cancelamento") || "").trim()
    clientRequestId = String(form.get("clientRequestId") || "").trim()
    const candidate = form.get("arquivo")
    file = candidate instanceof File && candidate.size > 0 ? candidate : null
  }

  if (clientRequestId && !/^[A-Za-z0-9._:-]{8,120}$/.test(clientRequestId)) {
    return NextResponse.json({ erro: "Identificador da publicação inválido." }, { status: 400 })
  }
  if (titulo.length < 3 || titulo.length > 180 || tema.length < 3 || tema.length > 180) {
    return NextResponse.json({ erro: "Informe título e tema válidos, com até 180 caracteres." }, { status: 400 })
  }
  if (!dataCivilIsoValida(data, { anoMinimo: 2020, anoMaximo: 2100 }) || !horario24hValido(horario, true)) {
    return NextResponse.json({ erro: "Data ou horário inválido." }, { status: 400 })
  }
  if (descricao.length > 4_000) return NextResponse.json({ erro: "A descrição deve ter no máximo 4.000 caracteres." }, { status: 400 })
  if (status === "cancelada" && (motivo.length < 3 || motivo.length > 1_000)) {
    return NextResponse.json({ erro: "Informe o motivo do cancelamento, com até 1.000 caracteres." }, { status: 400 })
  }

  let arquivoBuffer: Buffer | null = null
  let arquivoNome = ""
  let arquivoMime = ""
  let arquivoTamanho = 0
  let arquivoHash = ""
  if (file) {
    arquivoNome = file.name.trim().slice(0, 240)
    const ext = path.extname(arquivoNome).toLowerCase()
    if (!EXTENSOES.has(ext)) return NextResponse.json({ erro: "Tipo de arquivo não permitido. Use PDF, PowerPoint, Word, ODT/ODP ou TXT." }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ erro: "O arquivo deve ter no máximo 20 MB." }, { status: 400 })
    arquivoMime = file.type || "application/octet-stream"
    arquivoTamanho = file.size
    arquivoBuffer = Buffer.from(await file.arrayBuffer())
    arquivoHash = createHash("sha256").update(arquivoBuffer).digest("hex")
  }

  const fingerprint = fingerprintFormacao({
    titulo,
    tema,
    data,
    horario,
    descricao,
    status,
    motivo: status === "cancelada" ? motivo : "",
    arquivoNome,
    arquivoMime,
    arquivoTamanho,
    arquivoHash,
  })

  if (clientRequestId) {
    const existente = (listarFormacoes() as FormacaoIdempotente[]).find((formacao) =>
      formacao.criado_por === sessao.sub && formacao.client_request_id === clientRequestId
    )
    if (existente) {
      if (existente.client_request_fingerprint !== fingerprint) {
        return NextResponse.json({ erro: "Este identificador de publicação já foi usado com outro conteúdo." }, { status: 409 })
      }
      return NextResponse.json({ formacao: formacaoPublica(existente), duplicado: true, clientRequestId })
    }
  }

  let arquivo: FormacaoArquivo | null = null
  let storedPath: string | null = null
  if (arquivoBuffer) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const token = clientRequestId
      ? createHash("sha256").update(`${sessao.sub}:${clientRequestId}`).digest("hex").slice(0, 20)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const stored = `${token}-${sanitizar(arquivoNome)}`
    storedPath = path.join(UPLOAD_DIR, stored)
    fs.writeFileSync(storedPath, arquivoBuffer)
    arquivo = { nome_original: arquivoNome, nome_armazenado: stored, mime: arquivoMime, tamanho: arquivoTamanho }
  }

  try {
    const dados = {
      titulo,
      tema,
      data,
      horario: horario || null,
      descricao,
      status,
      motivo_cancelamento: status === "cancelada" ? motivo : null,
      arquivo,
      ...(clientRequestId ? {
        client_request_id: clientRequestId,
        client_request_fingerprint: fingerprint,
        criado_por: sessao.sub,
      } : {}),
    }
    const row = salvarFormacao(dados as Parameters<typeof salvarFormacao>[0]) as FormacaoIdempotente
    return NextResponse.json({ formacao: formacaoPublica(row), clientRequestId: clientRequestId || null }, { status: 201 })
  } catch (error) {
    if (storedPath) runCatchingUnlink(storedPath)
    throw error
  }
}

function runCatchingUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}
