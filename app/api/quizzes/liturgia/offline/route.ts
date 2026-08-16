import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarRespostaQuiz, buscarUsuario, salvarRespostaQuiz } from "@/lib/db"
import { garantirQuizLiturgiaOffline } from "@/lib/quiz-liturgia-offline"

export async function POST(req: NextRequest) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.status !== "aprovado" || (usuario.funcao !== "Acólito" && usuario.funcao !== "Coroinha")) {
    return NextResponse.json({ erro: "Quiz disponível apenas para perfis autorizados." }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { dataIso?: unknown; respostas?: unknown[]; clientRequestId?: unknown }
  const dataIso = String(body.dataIso || "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return NextResponse.json({ erro: "Data do quiz inválida." }, { status: 400 })

  const quiz = garantirQuizLiturgiaOffline(dataIso)
  if (!quiz) return NextResponse.json({ erro: "A Liturgia dessa data não está disponível para validar o quiz." }, { status: 404 })

  const concluida = buscarRespostaQuiz(quiz.id, usuario.id)
  if (concluida) return NextResponse.json({ ok: true, duplicado: true, resultado: concluida, mensagem: "Quiz já sincronizado." })

  const respostas = Array.isArray(body.respostas) ? body.respostas.map(Number) : []
  if (
    respostas.length !== quiz.perguntas.length ||
    respostas.some((valor, indice) => !Number.isInteger(valor) || valor < 0 || valor >= quiz.perguntas[indice].opcoes.length)
  ) {
    return NextResponse.json({ erro: "Respostas do quiz offline estão incompletas ou inválidas." }, { status: 400 })
  }

  let acertos = 0
  let pontos = 0
  let totalPontos = 0
  const detalhes = quiz.perguntas.map((pergunta, indice) => {
    const correto = respostas[indice] === pergunta.correta
    totalPontos += pergunta.pontos
    if (correto) {
      acertos += 1
      pontos += pergunta.pontos
    }
    return { perguntaId: pergunta.id, correto, correta: pergunta.correta }
  })

  const resultado = salvarRespostaQuiz({
    quiz_id: quiz.id,
    usuario_id: usuario.id,
    respostas,
    acertos,
    pontos,
    total_pontos: totalPontos,
  })

  return NextResponse.json({ ok: true, resultado, detalhes, mensagem: "Quiz offline sincronizado com a Jornada." })
}
