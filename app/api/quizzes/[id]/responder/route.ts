import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarQuiz, buscarRespostaQuiz, buscarUsuario, salvarRespostaQuiz } from "@/lib/db"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"
import { notificarMudancasRanking, snapshotRanking } from "@/lib/notificacoes-ranking"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return NextResponse.json({ erro: "Quiz disponível apenas para perfis autorizados." }, { status: 403 })

  const limite = limitar(`quiz:responder:${usuario.id}:${ipDaRequisicao(req)}`, 30, 60 * 60 * 1000)
  if (!limite.permitido) return NextResponse.json({ erro: "Muitas tentativas de quiz em pouco tempo. Aguarde antes de tentar novamente." }, { status: 429 })

  const { id } = await context.params
  if (!id || id.length > 180) return NextResponse.json({ erro: "Quiz inválido." }, { status: 400 })
  const quiz = buscarQuiz(id)
  if (!quiz || !quiz.ativo) return NextResponse.json({ erro: "Quiz não encontrado." }, { status: 404 })

  if (quiz.origem === "liturgia") {
    const hoje = dataCuiabaIso()
    if (!quiz.data_referencia || quiz.data_referencia !== hoje || !obterLiturgiaLocal(quiz.data_referencia)) {
      return NextResponse.json({ erro: "Este Quiz Litúrgico não está alinhado com a Liturgia offline disponível hoje." }, { status: 409 })
    }
  }

  const existente = buscarRespostaQuiz(id, usuario.id)
  if (existente) {
    return NextResponse.json({
      ok: true,
      duplicado: true,
      resultado: existente,
      mensagem: "Quiz já sincronizado.",
    })
  }

  const body = await req.json().catch(() => ({})) as { respostas?: unknown[]; clientRequestId?: unknown }
  const respostas = Array.isArray(body.respostas) ? body.respostas.map((v) => Number(v)) : []
  if (
    quiz.perguntas.length < 1 || quiz.perguntas.length > 50 ||
    respostas.length !== quiz.perguntas.length ||
    respostas.some((v, i) => !Number.isInteger(v) || v < 0 || v >= quiz.perguntas[i].opcoes.length)
  ) {
    return NextResponse.json({ erro: "Responda todas as perguntas com opções válidas." }, { status: 400 })
  }

  let acertos = 0, pontos = 0, totalPontos = 0
  const detalhes = quiz.perguntas.map((p, i) => {
    const correto = respostas[i] === p.correta
    totalPontos += p.pontos
    if (correto) { acertos += 1; pontos += p.pontos }
    return { perguntaId: p.id, correto, correta: p.correta, explicacao: p.explicacao || null }
  })

  const ano = Number(dataCuiabaIso().slice(0, 4))
  const antes = snapshotRanking(ano)
  const resultado = salvarRespostaQuiz({ quiz_id: quiz.id, usuario_id: usuario.id, respostas, acertos, pontos, total_pontos: totalPontos })
  notificarMudancasRanking(ano, antes, usuario.id, `quiz:${quiz.id}`)
  return NextResponse.json({ ok: true, resultado, detalhes, clientRequestId: String(body.clientRequestId || "") || null })
}
