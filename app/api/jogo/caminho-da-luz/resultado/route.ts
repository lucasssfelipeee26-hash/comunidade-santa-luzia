import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarRankingAjustes, salvarRankingAjuste } from "@/lib/db"
import { notificarMudancasRanking, snapshotRanking } from "@/lib/notificacoes-ranking"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const LIMITE_DIARIO = 35
const FASE_MAXIMA_COM_PONTOS = 10

function dataCuiaba() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function pontosAcumuladosPorFase(faseConcluida: number) {
  const fase = Math.max(0, Math.trunc(faseConcluida))
  if (fase <= 0) return 0
  const base = [0, 3, 7, 12, 18, 25]
  if (fase <= 5) return base[fase]
  return Math.min(LIMITE_DIARIO, 25 + (fase - 5) * 2)
}

function metaDaFase(nivel: number) {
  return 780 + Math.max(0, nivel - 1) * 260
}

function scoreMinimoAteFase(faseConcluida: number) {
  let total = 0
  for (let fase = 1; fase <= Math.max(0, faseConcluida); fase++) total += metaDaFase(fase)
  return total
}

async function usuarioAtual() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return usuario
}

function ajustesMissaoHoje(usuarioId: string) {
  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixoNovo = `Missão do Altar ${data}`
  const prefixoLegado = `Caminho da Luz ${data}`
  return listarRankingAjustes(ano).filter((a) =>
    a.usuario_id === usuarioId && (a.motivo.startsWith(prefixoNovo) || a.motivo.startsWith(prefixoLegado))
  )
}

function pontosDaMissaoHoje(usuarioId: string) {
  return ajustesMissaoHoje(usuarioId).reduce((total, ajuste) => total + ajuste.pontos, 0)
}

function faseEquivalenteAosPontos(pontos: number) {
  let fase = 0
  for (let atual = 1; atual <= FASE_MAXIMA_COM_PONTOS; atual++) {
    if (pontosAcumuladosPorFase(atual) <= pontos) fase = atual
    else break
  }
  return fase
}

function faseMaximaRegistrada(usuarioId: string, pontosAtuais: number) {
  let maior = faseEquivalenteAosPontos(pontosAtuais)
  for (const ajuste of ajustesMissaoHoje(usuarioId)) {
    const match = /fase concluída\s+(\d+)/i.exec(ajuste.motivo)
    if (match) maior = Math.max(maior, Math.trunc(Number(match[1]) || 0))
  }
  return Math.min(FASE_MAXIMA_COM_PONTOS, maior)
}

export async function GET() {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const pontosTotalDia = pontosDaMissaoHoje(usuario.id)
  return NextResponse.json({
    ok: true,
    pontosTotalDia,
    faseServidor: faseMaximaRegistrada(usuario.id, pontosTotalDia),
    limiteDiario: LIMITE_DIARIO,
  })
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const limite = limitar(`jogo:joias:${usuario.id}:${ipDaRequisicao(req)}`, 80, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ erro: "Muitos resultados enviados em pouco tempo. Aguarde alguns minutos e tente novamente." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const score = Math.trunc(Number(body.score || 0))
  const level = Math.trunc(Number(body.level || 1))
  const faseInformada = body.completedPhase == null ? null : Math.trunc(Number(body.completedPhase))
  const faseConcluida = faseInformada == null ? Math.max(0, level - 1) : faseInformada
  const mode = String(body.mode || "Joias da Luz").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) || "Joias da Luz"

  if (
    !Number.isFinite(score) || score < 0 || score > 1_000_000 ||
    !Number.isFinite(level) || level < 1 || level > 999 ||
    !Number.isFinite(faseConcluida) || faseConcluida < 0 || faseConcluida > 999 ||
    level !== faseConcluida + 1
  ) {
    return NextResponse.json({ erro: "Resultado inválido." }, { status: 400 })
  }

  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixoNovo = `Missão do Altar ${data}`
  const pontosCalculados = pontosAcumuladosPorFase(faseConcluida)
  const ajustesHoje = ajustesMissaoHoje(usuario.id)
  const pontosAtuais = ajustesHoje.reduce((total, ajuste) => total + ajuste.pontos, 0)
  const faseServidor = faseMaximaRegistrada(usuario.id, pontosAtuais)

  if (pontosCalculados <= pontosAtuais || faseConcluida <= faseServidor) {
    return NextResponse.json({
      ok: true,
      jaContabilizado: true,
      melhorado: false,
      pontosRanking: pontosAtuais,
      pontosAdicionados: 0,
      pontosTotalDia: pontosAtuais,
      faseConcluida,
      faseServidor,
      limiteDiario: LIMITE_DIARIO,
    })
  }

  if (faseServidor >= FASE_MAXIMA_COM_PONTOS) {
    return NextResponse.json({
      ok: true,
      jaContabilizado: true,
      melhorado: false,
      pontosRanking: pontosAtuais,
      pontosAdicionados: 0,
      pontosTotalDia: pontosAtuais,
      faseConcluida,
      faseServidor,
      limiteDiario: LIMITE_DIARIO,
    })
  }

  const proximaFase = faseServidor + 1
  if (faseConcluida !== proximaFase) {
    return NextResponse.json({
      erro: "A progressão recebida está fora de sequência. Sincronize as fases pendentes na ordem em que foram concluídas.",
      faseEsperada: proximaFase,
      faseServidor,
      pontosTotalDia: pontosAtuais,
      limiteDiario: LIMITE_DIARIO,
    }, { status: 409 })
  }

  const scoreMinimo = scoreMinimoAteFase(faseConcluida)
  if (score < scoreMinimo) {
    return NextResponse.json({
      erro: "A pontuação informada não é compatível com a fase concluída.",
      faseEsperada: proximaFase,
      faseServidor,
      pontosTotalDia: pontosAtuais,
      limiteDiario: LIMITE_DIARIO,
    }, { status: 409 })
  }

  const antes = snapshotRanking(ano)
  const pontosAdicionados = pontosCalculados - pontosAtuais
  const ajuste = salvarRankingAjuste({
    usuario_id: usuario.id,
    pontos: pontosAdicionados,
    motivo: `${prefixoNovo} · ${mode} · fase concluída ${faseConcluida} · score ${score} · total diário ${pontosCalculados}`,
    ano,
    criado_por: usuario.id,
  })
  notificarMudancasRanking(ano, antes, usuario.id, `missao:${data}:${faseConcluida}`)

  return NextResponse.json({
    ok: true,
    jaContabilizado: false,
    melhorado: pontosAtuais > 0,
    pontosRanking: pontosAdicionados,
    pontosAdicionados,
    pontosTotalDia: pontosCalculados,
    faseConcluida,
    faseServidor: faseConcluida,
    limiteDiario: LIMITE_DIARIO,
    ajusteId: ajuste.id,
  })
}
