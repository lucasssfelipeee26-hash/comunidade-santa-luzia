import { NextRequest, NextResponse } from "next/server"
import { GET as obterLiturgiaResponse } from "@/app/api/liturgia/route"
import { lerSessao } from "@/lib/auth"
import { buscarRespostaQuiz, buscarUsuario, salvarRespostaQuiz } from "@/lib/db"
import { gerarPerguntasLiturgia, quizDiarioId, validarTentativa } from "@/lib/quiz-liturgia"

export async function POST(req: NextRequest) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) {
    return NextResponse.json({ erro: "Quiz disponível apenas para perfis autorizados." }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { token?: string; respostas?: unknown[] }
  const token = String(body.token || "")
  if (!token) return NextResponse.json({ erro: "Tentativa de quiz inválida." }, { status: 400 })

  let tentativa
  try {
    tentativa = await validarTentativa(token, usuario.id)
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "O tempo acabou. Abra um novo quiz." }, { status: 410 })
  }

  const quizId = quizDiarioId(tentativa.data)
  const concluida = buscarRespostaQuiz(quizId, usuario.id)
  if (concluida) return NextResponse.json({ erro: "O quiz de hoje já foi concluído.", resultado: concluida }, { status: 409 })

  const respostaLiturgia = await obterLiturgiaResponse()
  const liturgia = await respostaLiturgia.json().catch(() => null)
  if (!respostaLiturgia.ok || !liturgia) {
    return NextResponse.json({ erro: "Não foi possível validar a Liturgia agora." }, { status: 503 })
  }

  const perguntas = gerarPerguntasLiturgia(liturgia, tentativa.nonce)
  const respostas = Array.isArray(body.respostas) ? body.respostas.map(Number) : []
  if (
    perguntas.length < 3 ||
    respostas.length !== perguntas.length ||
    respostas.some((v, i) => !Number.isInteger(v) || v < 0 || v >= perguntas[i].opcoes.length)
  ) {
    return NextResponse.json({ erro: "Responda todas as perguntas antes de enviar." }, { status: 400 })
  }

  let acertos = 0
  let pontos = 0
  let totalPontos = 0
  const detalhes = perguntas.map((p, i) => {
    const correto = respostas[i] === p.correta
    totalPontos += p.pontos
    if (correto) {
      acertos += 1
      pontos += p.pontos
    }
    return { perguntaId: p.id, correto, correta: p.correta }
  })

  const resultado = salvarRespostaQuiz({
    quiz_id: quizId,
    usuario_id: usuario.id,
    respostas,
    acertos,
    pontos,
    total_pontos: totalPontos,
  })

  return NextResponse.json({ ok: true, resultado, detalhes })
}
