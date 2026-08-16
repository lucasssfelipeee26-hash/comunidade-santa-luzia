import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarRankingAjustes, salvarRankingAjuste } from "@/lib/db"
import { notificarMudancasRanking, snapshotRanking } from "@/lib/notificacoes-ranking"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const LIMITE_DIARIO = 30
const TOTAL_RODADAS = 24
const RODADA_MAXIMA_COM_PONTOS = 15

type Dificuldade = "facil" | "medio" | "dificil"

function dataCuiaba() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function pontosAcumuladosPorRodada(rodadaConcluida: number) {
  const rodada = Math.max(0, Math.min(RODADA_MAXIMA_COM_PONTOS, Math.trunc(rodadaConcluida)))
  return Math.min(LIMITE_DIARIO, rodada * 2)
}

async function usuarioAtual() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return usuario
}

function ajustesWhatajongHoje(usuarioId: string) {
  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixo = `Whatajong ${data}`
  return listarRankingAjustes(ano).filter((a) => a.usuario_id === usuarioId && a.motivo.startsWith(prefixo))
}

function pontosWhatajongHoje(usuarioId: string) {
  return ajustesWhatajongHoje(usuarioId).reduce((total, ajuste) => total + ajuste.pontos, 0)
}

function rodadaMaximaRegistrada(usuarioId: string) {
  let maior = 0
  for (const ajuste of ajustesWhatajongHoje(usuarioId)) {
    const match = /rodada concluída\s+(\d+)/i.exec(ajuste.motivo)
    if (match) maior = Math.max(maior, Math.trunc(Number(match[1]) || 0))
  }
  return Math.min(TOTAL_RODADAS, maior)
}

export async function GET() {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  return NextResponse.json({
    ok: true,
    pontosTotalDia: pontosWhatajongHoje(usuario.id),
    rodadaServidor: rodadaMaximaRegistrada(usuario.id),
    limiteDiario: LIMITE_DIARIO,
    totalRodadas: TOTAL_RODADAS,
  })
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const limite = limitar(`jogo:whatajong:${usuario.id}:${ipDaRequisicao(req)}`, 80, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ erro: "Muitos resultados enviados em pouco tempo. Aguarde alguns minutos e tente novamente." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const score = Math.trunc(Number(body.score || 0))
  const completedRound = Math.trunc(Number(body.completedRound || 0))
  const dificuldadeBruta = String(body.difficulty || "facil")
  const difficulty: Dificuldade = dificuldadeBruta === "medio" || dificuldadeBruta === "dificil" ? dificuldadeBruta : "facil"

  if (
    !Number.isFinite(score) || score < 0 || score > 50_000_000 ||
    !Number.isFinite(completedRound) || completedRound < 1 || completedRound > TOTAL_RODADAS
  ) {
    return NextResponse.json({ erro: "Resultado inválido." }, { status: 400 })
  }

  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixo = `Whatajong ${data}`
  const pontosAtuais = pontosWhatajongHoje(usuario.id)
  const rodadaServidor = rodadaMaximaRegistrada(usuario.id)
  const pontosCalculados = pontosAcumuladosPorRodada(completedRound)

  if (completedRound <= rodadaServidor || pontosCalculados <= pontosAtuais) {
    return NextResponse.json({
      ok: true,
      jaContabilizado: true,
      melhorado: false,
      pontosRanking: pontosAtuais,
      pontosAdicionados: 0,
      pontosTotalDia: pontosAtuais,
      rodadaConcluida: completedRound,
      rodadaServidor: Math.max(rodadaServidor, completedRound),
      limiteDiario: LIMITE_DIARIO,
    })
  }

  const antes = snapshotRanking(ano)
  const pontosAdicionados = Math.max(0, pontosCalculados - pontosAtuais)

  if (pontosAdicionados > 0) {
    salvarRankingAjuste({
      usuario_id: usuario.id,
      pontos: pontosAdicionados,
      motivo: `${prefixo} · ${difficulty} · rodada concluída ${completedRound} · score original ${score} · total diário ${pontosCalculados}`,
      ano,
      criado_por: usuario.id,
    })
    notificarMudancasRanking(ano, antes, usuario.id, `whatajong:${data}:${completedRound}`)
  }

  return NextResponse.json({
    ok: true,
    jaContabilizado: pontosAdicionados === 0,
    melhorado: pontosAtuais > 0 && pontosAdicionados > 0,
    pontosRanking: pontosAdicionados,
    pontosAdicionados,
    pontosTotalDia: pontosCalculados,
    rodadaConcluida: completedRound,
    rodadaServidor: completedRound,
    limiteDiario: LIMITE_DIARIO,
  })
}
