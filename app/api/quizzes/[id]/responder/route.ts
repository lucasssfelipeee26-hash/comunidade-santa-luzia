import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarQuiz, buscarRespostaQuiz, buscarUsuario, salvarRespostaQuiz } from "@/lib/db"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return NextResponse.json({ erro: "Quiz disponível apenas para perfis autorizados." }, { status: 403 })

  const { id } = await context.params
  const quiz = buscarQuiz(id)
  if (!quiz || !quiz.ativo) return NextResponse.json({ erro: "Quiz não encontrado." }, { status: 404 })

  if (quiz.origem === "liturgia") {
    const hoje = dataCuiabaIso()
    if (!quiz.data_referencia || quiz.data_referencia !== hoje || !obterLiturgiaLocal(quiz.data_referencia)) {
      return NextResponse.json({ erro: "Este Quiz Litúrgico não está alinhado com a Liturgia offline disponível hoje." }, { status: 409 })
    }
  }

  const existente = buscarRespostaQuiz(id, usuario.id)
  if (existente) return NextResponse.json({ erro: "Este quiz já foi respondido.", resultado: existente }, { status: 409 })

  const body = await req.json().catch(() => ({})) as { respostas?: unknown[] }
  const respostas = Array.isArray(body.respostas) ? body.respostas.map((v) => Number(v)) : []
  if (respostas.length !== quiz.perguntas.length) return NextResponse.json({ erro: "Responda todas as perguntas." }, { status: 400 })

  let acertos = 0, pontos = 0, totalPontos = 0
  const detalhes = quiz.perguntas.map((p, i) => {
    const correto = respostas[i] === p.correta
    totalPontos += p.pontos
    if (correto) { acertos += 1; pontos += p.pontos }
    return { perguntaId: p.id, correto, correta: p.correta, explicacao: p.explicacao || null }
  })

  const resultado = salvarRespostaQuiz({ quiz_id: quiz.id, usuario_id: usuario.id, respostas, acertos, pontos, total_pontos: totalPontos })
  return NextResponse.json({ ok: true, resultado, detalhes })
}
