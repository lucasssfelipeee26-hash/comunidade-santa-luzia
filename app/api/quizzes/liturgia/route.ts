import { NextResponse } from "next/server"
import { GET as obterLiturgiaResponse } from "@/app/api/liturgia-local/route"
import { lerSessao } from "@/lib/auth"
import { buscarRespostaQuiz, buscarUsuario } from "@/lib/db"
import { criarTentativa, gerarPerguntasLiturgia, quizDiarioId } from "@/lib/quiz-liturgia"

export const dynamic = "force-dynamic"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) {
    return NextResponse.json({ erro: "Quiz disponível apenas para perfis autorizados." }, { status: 403 })
  }

  const tentativa = await criarTentativa(usuario.id)
  const quizId = quizDiarioId(tentativa.data)
  const existente = buscarRespostaQuiz(quizId, usuario.id)
  if (existente) {
    return NextResponse.json({ respondido: true, resultado: existente, data: tentativa.data }, { headers: { "Cache-Control": "no-store" } })
  }

  const respostaLiturgia = await obterLiturgiaResponse()
  const liturgia = await respostaLiturgia.json().catch(() => null)
  if (!respostaLiturgia.ok || !liturgia) {
    return NextResponse.json({ erro: "A Liturgia de hoje ainda não pôde ser carregada para gerar o quiz." }, { status: 503 })
  }

  const perguntas = gerarPerguntasLiturgia(liturgia, tentativa.nonce)
  if (perguntas.length < 3) {
    return NextResponse.json({ erro: "Ainda não há informações suficientes na Liturgia de hoje para montar o quiz." }, { status: 503 })
  }

  return NextResponse.json({
    respondido: false,
    quiz: {
      token: tentativa.token,
      titulo: "Quiz da Liturgia de Hoje",
      descricao: "Perguntas geradas automaticamente a partir da mesma Liturgia Diária apresentada no aplicativo.",
      expiraEm: tentativa.expiraEm,
      duracaoSegundos: tentativa.duracaoSegundos,
      perguntas: perguntas.map((p) => ({ id: p.id, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos })),
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
