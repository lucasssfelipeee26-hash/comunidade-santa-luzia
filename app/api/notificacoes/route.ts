import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarEscalas, listarQuizzes, obterRankingConfig } from "@/lib/db"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  salvarNotificacao,
} from "@/lib/notificacoes"

export const dynamic = "force-dynamic"

async function contexto() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return usuario
}

function garantirAvisosDiarios(usuarioId: string) {
  const hoje = dataCuiabaIso()
  if (obterLiturgiaLocal(hoje)) {
    salvarNotificacao({
      usuario_id: usuarioId,
      chave: `quiz-hoje:${hoje}`,
      tipo: "quiz",
      titulo: "Quiz de hoje disponível",
      mensagem: "Leia a Liturgia de hoje e conclua o Quiz Litúrgico da Jornada.",
      href: "/area-restrita/ranking?aba=hoje",
    })
  }
  salvarNotificacao({
    usuario_id: usuarioId,
    chave: `missao-hoje:${hoje}`,
    tipo: "missao",
    titulo: "Missão do Altar disponível",
    mensagem: "Avance pelas fases e conquiste até 35 pontos por dia na classificação.",
    href: "/area-restrita/ranking?aba=missao",
  })
  salvarNotificacao({
    usuario_id: usuarioId,
    chave: `classificacao-hoje:${hoje}`,
    tipo: "ranking",
    titulo: "Confira a classificação",
    mensagem: "Veja sua posição atual e acompanhe quem subiu no ranking da Jornada Litúrgica.",
    href: "/area-restrita/ranking?aba=classificacao",
  })
}

export async function GET() {
  const usuario = await contexto()
  if (!usuario) return NextResponse.json({ autenticado: false }, { status: 401 })

  garantirAvisosDiarios(usuario.id)
  const hoje = dataCuiabaIso()
  const ano = Number(hoje.slice(0, 4))
  const escalas = listarEscalas()
    .filter((e) => e.data >= hoje && e.pessoas.some((p) => p.id === usuario.id || p.nome === usuario.nome))
    .slice(0, 20)
  const quizzesPendentes = listarQuizzes(false).filter((q) => !q.data_referencia || q.data_referencia >= hoje).length
  const notificacoes = listarNotificacoes(usuario.id)

  return NextResponse.json({
    autenticado: true,
    usuario: { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo },
    minutosAntecedencia: obterRankingConfig(ano).minutos_antecedencia,
    escalas,
    quizzesPendentes,
    notificacoes,
    naoLidas: notificacoes.filter((n) => !n.lida_em).length,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } })
}

export async function POST(req: NextRequest) {
  const usuario = await contexto()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || "lida")

  if (action === "todas") {
    return NextResponse.json({ ok: true, alteradas: marcarTodasNotificacoesLidas(usuario.id) })
  }

  const id = String(body.id || "")
  if (!id || !marcarNotificacaoLida(usuario.id, id)) {
    return NextResponse.json({ erro: "Notificação não encontrada." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
