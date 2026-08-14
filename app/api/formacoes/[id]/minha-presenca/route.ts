import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  buscarFormacao,
  buscarUsuario,
  listarHistoricoFormacaoUsuario,
  salvarPresencasFormacao,
  type FormacaoPresencaStatus,
} from "@/lib/db"

export const dynamic = "force-dynamic"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login para registrar sua presença." }, { status: 401 })
  }

  const usuario = buscarUsuario(sessao.sub)
  if (
    !usuario ||
    usuario.status !== "aprovado" ||
    (usuario.funcao !== "Acólito" && usuario.funcao !== "Coroinha")
  ) {
    return NextResponse.json({ erro: "Seu cadastro não está liberado para a lista de presença." }, { status: 403 })
  }

  const { id } = await params
  const formacao = buscarFormacao(id)
  if (!formacao) {
    return NextResponse.json({ erro: "Formação não encontrada." }, { status: 404 })
  }
  if (formacao.status === "cancelada") {
    return NextResponse.json({ erro: "Não é possível registrar presença em uma formação cancelada." }, { status: 409 })
  }

  const body = await request.json().catch(() => null) as {
    situacao?: unknown
    justificativa?: unknown
  } | null
  const situacao = String(body?.situacao ?? "") as FormacaoPresencaStatus
  if (!["presente", "falta", "justificada"].includes(situacao)) {
    return NextResponse.json({ erro: "Situação de presença inválida." }, { status: 400 })
  }

  const justificativa = String(body?.justificativa ?? "").trim()
  if (situacao === "justificada" && justificativa.length < 3) {
    return NextResponse.json({ erro: "Informe o motivo da falta justificada." }, { status: 400 })
  }
  if (justificativa.length > 500) {
    return NextResponse.json({ erro: "A justificativa deve ter no máximo 500 caracteres." }, { status: 400 })
  }

  salvarPresencasFormacao(
    id,
    [{
      usuario_id: sessao.sub,
      status: situacao,
      justificativa: situacao === "justificada" ? justificativa : null,
    }],
    sessao.sub,
  )

  const presenca = listarHistoricoFormacaoUsuario(sessao.sub)
    .find((item) => item.formacao_id === id)

  return NextResponse.json({
    ok: true,
    presenca: presenca
      ? {
          status: presenca.status,
          justificativa: presenca.justificativa,
          atualizado_em: presenca.atualizado_em,
        }
      : null,
  })
}
