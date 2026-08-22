import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { lerSessao } from "@/lib/auth"
import { atualizarFormacao, listarEquipeAprovada, listarFormacoes, listarHistoricoFormacaoUsuario, listarPresencasFormacao, salvarFormacao, type FormacaoArquivo, DATA_DIR } from "@/lib/db"
import { salvarNotificacao } from "@/lib/notificacoes"
import { dataCivilIsoValida, horario24hValido } from "@/lib/validation"

export const runtime = "nodejs"

const UPLOAD_DIR = path.join(DATA_DIR, "formacoes")
const MAX_FILE_SIZE = 20 * 1024 * 1024
const EXTENSOES = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".odt", ".odp", ".txt"])

function sanitizar(nome: string) { return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-180) || "arquivo" }

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
  const formacoes = listarFormacoes().map((formacao) => {
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

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ erro: "Não foi possível ler os dados da formação." }, { status: 400 })
  }

  const titulo = String(form.get("titulo") || "").trim().replace(/\s+/g, " ")
  const tema = String(form.get("tema") || "").trim().replace(/\s+/g, " ")
  const data = String(form.get("data") || "").trim()
  const horario = String(form.get("horario") || "").trim()
  const descricao = String(form.get("descricao") || "").trim()
  const status = String(form.get("status") || "agendada") === "cancelada" ? "cancelada" : "agendada"
  const motivo = String(form.get("motivo_cancelamento") || "").trim()
  const file = form.get("arquivo")

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

  let arquivo: FormacaoArquivo | null = null
  if (file instanceof File && file.size > 0) {
    const nomeOriginal = file.name.trim().slice(0, 240)
    const ext = path.extname(nomeOriginal).toLowerCase()
    if (!EXTENSOES.has(ext)) return NextResponse.json({ erro: "Tipo de arquivo não permitido. Use PDF, PowerPoint, Word, ODT/ODP ou TXT." }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ erro: "O arquivo deve ter no máximo 20 MB." }, { status: 400 })
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizar(nomeOriginal)}`
    fs.writeFileSync(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()))
    arquivo = { nome_original: nomeOriginal, nome_armazenado: stored, mime: file.type || "application/octet-stream", tamanho: file.size }
  }

  const row = salvarFormacao({ titulo, tema, data, horario: horario || null, descricao, status, motivo_cancelamento: status === "cancelada" ? motivo : null, arquivo })
  return NextResponse.json({ formacao: row }, { status: 201 })
}
