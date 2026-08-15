import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarRankingAjustes, salvarRankingAjuste } from "@/lib/db"

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
  const base = [0, 2, 5, 9, 14, 20]
  if (fase <= 5) return base[fase]
  return Math.min(30, 20 + (fase - 5) * 2)
}

async function usuarioAtual() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return usuario
}

function pontosDaMissaoHoje(usuarioId: string) {
  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixoNovo = `Missão do Altar ${data}`
  const prefixoLegado = `Caminho da Luz ${data}`
  return listarRankingAjustes(ano)
    .filter((a) => a.usuario_id === usuarioId && (a.motivo.startsWith(prefixoNovo) || a.motivo.startsWith(prefixoLegado)))
    .reduce((total, ajuste) => total + ajuste.pontos, 0)
}

export async function GET() {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  return NextResponse.json({
    ok: true,
    pontosTotalDia: pontosDaMissaoHoje(usuario.id),
    limiteDiario: 30,
  })
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const score = Math.trunc(Number(body.score || 0))
  const level = Math.trunc(Number(body.level || 1))
  const faseInformada = body.completedPhase == null ? null : Math.trunc(Number(body.completedPhase))
  const faseConcluida = faseInformada == null ? Math.max(0, level - 1) : faseInformada
  const mode = String(body.mode || "Missão do Altar").slice(0, 80)

  if (
    !Number.isFinite(score) || score < 0 || score > 1_000_000 ||
    !Number.isFinite(level) || level < 1 || level > 999 ||
    !Number.isFinite(faseConcluida) || faseConcluida < 0 || faseConcluida > 999
  ) {
    return NextResponse.json({ erro: "Resultado inválido." }, { status: 400 })
  }

  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixoNovo = `Missão do Altar ${data}`
  const prefixoLegado = `Caminho da Luz ${data}`

  // A pontuação da Missão é conquistada por fase concluída e limitada a 30 pontos por dia.
  // F1=2, F2=5 acumulados, F3=9, F4=14, F5=20; depois +2 por fase extra.
  const pontosCalculados = pontosAcumuladosPorFase(faseConcluida)
  const ajustesHoje = listarRankingAjustes(ano).filter((a) =>
    a.usuario_id === usuario.id && (a.motivo.startsWith(prefixoNovo) || a.motivo.startsWith(prefixoLegado))
  )
  const pontosAtuais = ajustesHoje.reduce((total, ajuste) => total + ajuste.pontos, 0)

  // A chamada pode acontecer ao concluir cada fase, ao terminar a rodada e novamente após
  // reconexão. Só a diferença positiva é salva, então nunca há pontuação duplicada.
  if (pontosCalculados <= pontosAtuais) {
    return NextResponse.json({
      ok: true,
      jaContabilizado: true,
      melhorado: false,
      pontosRanking: pontosAtuais,
      pontosAdicionados: 0,
      pontosTotalDia: pontosAtuais,
      faseConcluida,
      limiteDiario: 30,
    })
  }

  const pontosAdicionados = pontosCalculados - pontosAtuais
  const ajuste = salvarRankingAjuste({
    usuario_id: usuario.id,
    pontos: pontosAdicionados,
    motivo: `${prefixoNovo} · ${mode} · fase concluída ${faseConcluida} · score ${score} · total diário ${pontosCalculados}`,
    ano,
    criado_por: usuario.id,
  })

  return NextResponse.json({
    ok: true,
    jaContabilizado: false,
    melhorado: pontosAtuais > 0,
    pontosRanking: pontosAdicionados,
    pontosAdicionados,
    pontosTotalDia: pontosCalculados,
    faseConcluida,
    limiteDiario: 30,
    ajusteId: ajuste.id,
  })
}
