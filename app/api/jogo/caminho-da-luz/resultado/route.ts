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
  const mode = String(body.mode || "Caminho da Luz").slice(0, 80)
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000 || !Number.isFinite(level) || level < 1 || level > 999) {
    return NextResponse.json({ erro: "Resultado inválido." }, { status: 400 })
  }

  const data = dataCuiaba()
  const ano = Number(data.slice(0, 4))
  const prefixo = `Caminho da Luz ${data}`
  const existente = listarRankingAjustes(ano).find((a) => a.usuario_id === usuario.id && a.motivo.startsWith(prefixo))
  if (existente) {
    return NextResponse.json({ ok: true, jaContabilizado: true, pontosRanking: existente.pontos })
  }

  // O jogo roda no aparelho. O servidor recebe apenas um bônus diário limitado,
  // evitando que a pontuação bruta do minigame domine o Quiz Litúrgico.
  const pontosRanking = Math.max(1, Math.min(30, Math.floor(score / 250) + Math.min(level, 10)))
  const ajuste = salvarRankingAjuste({
    usuario_id: usuario.id,
    pontos: pontosRanking,
    motivo: `${prefixo} · ${mode} · score ${score} · nível ${level}`,
    ano,
    criado_por: usuario.id,
  })

  return NextResponse.json({ ok: true, jaContabilizado: false, pontosRanking, ajusteId: ajuste.id })
}
