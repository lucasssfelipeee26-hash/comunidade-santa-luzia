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

export async function POST(req: NextRequest) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const score = Math.trunc(Number(body.score))
  const level = Math.trunc(Number(body.level))
  const mode = String(body.mode || "Missão do Altar").slice(0, 80)
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000 || !Number.isFinite(level) || level < 1 || level > 999) {
    return NextResponse.json({ erro: "Resultado inválido." }, { status: 400 })
  }

  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixoNovo = `Missão do Altar ${data}`
  const prefixoLegado = `Caminho da Luz ${data}`

  // A Missão do Altar roda no aparelho. O servidor recebe apenas um bônus diário limitado,
  // evitando que a pontuação bruta do minigame domine as demais atividades da Jornada Litúrgica.
  const pontosCalculados = Math.max(1, Math.min(30, Math.floor(score / 250) + Math.min(level, 10)))
  const ajustesHoje = listarRankingAjustes(ano).filter((a) =>
    a.usuario_id === usuario.id && (a.motivo.startsWith(prefixoNovo) || a.motivo.startsWith(prefixoLegado))
  )
  const pontosAtuais = ajustesHoje.reduce((total, ajuste) => total + ajuste.pontos, 0)

  // O jogador pode tentar novamente durante o dia. Só a melhora é acrescentada,
  // portanto repetir partidas nunca ultrapassa o melhor bônus diário já alcançado.
  if (pontosCalculados <= pontosAtuais) {
    return NextResponse.json({
      ok: true,
      jaContabilizado: true,
      melhorado: false,
      pontosRanking: pontosAtuais,
      pontosTotalDia: pontosAtuais,
    })
  }

  const pontosAdicionados = pontosCalculados - pontosAtuais
  const ajuste = salvarRankingAjuste({
    usuario_id: usuario.id,
    pontos: pontosAdicionados,
    motivo: `${prefixoNovo} · ${mode} · score ${score} · nível ${level} · melhor diário ${pontosCalculados}`,
    ano,
    criado_por: usuario.id,
  })

  return NextResponse.json({
    ok: true,
    jaContabilizado: false,
    melhorado: pontosAtuais > 0,
    pontosRanking: pontosAdicionados,
    pontosTotalDia: pontosCalculados,
    ajusteId: ajuste.id,
  })
}
