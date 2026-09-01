import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  buscarFormacao,
  buscarUsuario,
  listarHistoricoFormacaoUsuario,
  salvarPresencasFormacao,
  type FormacaoPresencaStatus,
} from "@/lib/db"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

function dataEmCuiaba(data: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data)
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]))
  return `${mapa.year}-${mapa.month}-${mapa.day}`
}

function hojeEmCuiaba() {
  return dataEmCuiaba(new Date())
}

function respostaPresenca(presenca: ReturnType<typeof listarHistoricoFormacaoUsuario>[number] | undefined) {
  return presenca
    ? {
        status: presenca.status,
        justificativa: presenca.justificativa,
        atualizado_em: presenca.atualizado_em,
      }
    : null
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const limite = limitar(`formacao:minha-presenca:${usuario.id}:${ipDaRequisicao(request)}`, 30, 60 * 60 * 1000)
  if (!limite.permitido) return NextResponse.json({ erro: "Muitas alterações em pouco tempo. Aguarde antes de tentar novamente." }, { status: 429 })

  const { id } = await params
  if (!id || id.length > 160) return NextResponse.json({ erro: "Formação inválida." }, { status: 400 })
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
    clientRequestId?: unknown
    criadoNoAparelhoEm?: unknown
  } | null
  const situacao = String(body?.situacao ?? "") as FormacaoPresencaStatus
  const clientRequestId = String(body?.clientRequestId ?? "").trim()
  const criadoNoAparelhoEm = Number(body?.criadoNoAparelhoEm)
  const windowsBeta = /SantaLuziaWindowsBeta\//.test(request.headers.get("user-agent") || "") || request.headers.get("x-santa-luzia-windows-beta") === "1"

  if (windowsBeta && situacao === "falta") {
    return NextResponse.json({ erro: "A falta é registrada somente pela moderação." }, { status: 403 })
  }

  const anterior = listarHistoricoFormacaoUsuario(sessao.sub).find((item) => item.formacao_id === id)

  // Toda operação offline recebe um clientRequestId estável. Se a primeira tentativa
  // chegou ao servidor mas a resposta se perdeu, o reenvio deve ser idempotente.
  if (clientRequestId && anterior) {
    return NextResponse.json(
      { ok: true, idempotente: true, presenca: respostaPresenca(anterior) },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  }

  if (windowsBeta && anterior) {
    return NextResponse.json({ erro: "Sua participação já foi registrada e não pode mais ser alterada.", presenca: anterior }, { status: 409 })
  }

  const hoje = hojeEmCuiaba()
  const timestampOfflineValido =
    clientRequestId.length >= 8 &&
    Number.isFinite(criadoNoAparelhoEm) &&
    criadoNoAparelhoEm > 0 &&
    criadoNoAparelhoEm <= Date.now() + 5 * 60_000
  const dataRegistroOffline = timestampOfflineValido ? dataEmCuiaba(new Date(criadoNoAparelhoEm)) : ""
  const replayOfflineDoDia = formacao.data < hoje && dataRegistroOffline === formacao.data

  if (formacao.data !== hoje) {
    if (replayOfflineDoDia) {
      // Registro feito no aparelho no dia correto e sincronizado depois.
    } else if (windowsBeta && formacao.data > hoje && situacao === "justificada") {
      // A Beta Windows permite justificar desde a publicação da formação.
    } else {
      const mensagem = formacao.data > hoje
        ? "A presença só poderá ser marcada no dia da formação."
        : "O período para marcar presença nesta formação já terminou."
      return NextResponse.json({ erro: mensagem, dataFormacao: formacao.data, hoje }, { status: 409 })
    }
  }

  if (replayOfflineDoDia && situacao === "presente" && formacao.horario) {
    const inicio = Date.parse(`${formacao.data}T${formacao.horario}:00-04:00`)
    if (Number.isFinite(inicio) && criadoNoAparelhoEm < inicio) {
      return NextResponse.json({ erro: `A presença só poderia ser registrada a partir das ${formacao.horario}.` }, { status: 409 })
    }
  }

  if (windowsBeta && situacao === "presente" && formacao.horario) {
    const inicio = Date.parse(`${formacao.data}T${formacao.horario}:00-04:00`)
    if (Number.isFinite(inicio) && Date.now() < inicio) {
      return NextResponse.json({ erro: `A presença será liberada às ${formacao.horario}.` }, { status: 425 })
    }
  }

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
    presenca: respostaPresenca(presenca),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } })
}
