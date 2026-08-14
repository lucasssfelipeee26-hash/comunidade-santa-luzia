import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  buscarFormacao,
  listarEquipeAprovada,
  listarPresencasFormacao,
  salvarPresencasFormacao,
  type FormacaoPresencaStatus,
} from "@/lib/db"

export const dynamic = "force-dynamic"

type SituacaoRecebida = FormacaoPresencaStatus | "nao_registrado"

function acessoNegado() {
  return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return acessoNegado()

  const { id } = await params
  if (!buscarFormacao(id)) {
    return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  }

  const presencas = new Map(
    listarPresencasFormacao(id).map((presenca) => [presenca.usuario_id, presenca]),
  )
  const participantes = listarEquipeAprovada().map((usuario) => {
    const presenca = presencas.get(usuario.id)
    return {
      id: usuario.id,
      nome: usuario.nome,
      funcao: usuario.funcao,
      situacao: presenca?.status ?? "nao_registrado",
      justificativa: presenca?.justificativa ?? "",
      atualizado_em: presenca?.atualizado_em ?? null,
    }
  })

  return NextResponse.json(
    { participantes },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return acessoNegado()

  const { id } = await params
  if (!buscarFormacao(id)) {
    return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  }

  const body = await request.json().catch(() => null) as {
    presencas?: Array<{ usuarioId?: unknown; situacao?: unknown; justificativa?: unknown }>
  } | null
  if (!body || !Array.isArray(body.presencas)) {
    return NextResponse.json({ erro: "Envie a lista de presença da formação." }, { status: 400 })
  }

  const equipe = new Map(listarEquipeAprovada().map((usuario) => [usuario.id, usuario]))
  const idsRecebidos = new Set<string>()
  const registros: Array<{
    usuario_id: string
    status: FormacaoPresencaStatus | null
    justificativa: string | null
  }> = []

  for (const item of body.presencas) {
    const usuarioId = String(item.usuarioId ?? "").trim()
    if (!usuarioId || idsRecebidos.has(usuarioId) || !equipe.has(usuarioId)) {
      return NextResponse.json({ erro: "A lista contém um usuário inválido ou duplicado." }, { status: 400 })
    }
    idsRecebidos.add(usuarioId)

    const situacao = String(item.situacao ?? "") as SituacaoRecebida
    if (!["nao_registrado", "presente", "falta", "justificada"].includes(situacao)) {
      return NextResponse.json({ erro: "Situação de presença inválida." }, { status: 400 })
    }

    const justificativa = String(item.justificativa ?? "").trim()
    if (situacao === "justificada" && justificativa.length < 3) {
      return NextResponse.json(
        { erro: `Informe a justificativa da falta de ${equipe.get(usuarioId)?.nome}.` },
        { status: 400 },
      )
    }
    if (justificativa.length > 500) {
      return NextResponse.json({ erro: "A justificativa deve ter no máximo 500 caracteres." }, { status: 400 })
    }

    registros.push({
      usuario_id: usuarioId,
      status: situacao === "nao_registrado" ? null : situacao,
      justificativa: situacao === "justificada" ? justificativa : null,
    })
  }

  salvarPresencasFormacao(id, registros, sessao.sub)
  return NextResponse.json({ ok: true, participantesAtualizados: registros.length })
}
