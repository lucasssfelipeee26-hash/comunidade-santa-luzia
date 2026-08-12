import { jwtVerify } from "jose"
import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarRespostasQuiz, salvarRespostaQuiz } from "@/lib/db"
import { gerarQuizLiturgia, type LiturgiaQuizFonte } from "@/lib/liturgy-quiz"

function secret() {
  const valor = process.env.AUTH_SECRET?.trim()
  if (!valor) throw new Error("AUTH_SECRET não configurado.")
  return new TextEncoder().encode(valor)
}

export async function POST(req: NextRequest) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return NextResponse.json({ erro: "Perfil sem acesso ao quiz." }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { token?: string; respostas?: unknown[] }
  const token = String(body.token || "")
  if (!token) return NextResponse.json({ erro: "Tentativa de quiz inválida." }, { status: 400 })

  let seed = ""
  let dataIso = ""
  try {
    const verificado = await jwtVerify(token, secret())
    if (verificado.payload.kind !== "liturgy-quiz" || verificado.payload.sub !== usuario.id) throw new Error("token")
    seed = String(verificado.payload.seed || "")
    dataIso = String(verificado.payload.dataIso || "")
    if (!seed || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) throw new Error("payload")
  } catch {
    return NextResponse.json({ erro: "O tempo acabou ou esta tentativa foi encerrada. Abra um novo quiz." }, { status: 410 })
  }

  const prefixo = `liturgia-auto:${dataIso}:`
  const concluida = listarRespostasQuiz().find((r) => r.usuario_id === usuario.id && r.quiz_id.startsWith(prefixo))
  if (concluida) return NextResponse.json({ erro: "O quiz de hoje já foi concluído.", resultado: concluida }, { status: 409 })

  const respostaLiturgia = await fetch(new URL("/api/liturgia", req.url), { cache: "no-store" })
  if (!respostaLiturgia.ok) return NextResponse.json({ erro: "Não foi possível validar a Liturgia agora." }, { status: 503 })
  const fonte = await respostaLiturgia.json() as LiturgiaQuizFonte
  const perguntas = gerarQuizLiturgia(fonte, seed)

  const respostas = Array.isArray(body.respostas) ? body.respostas.map(Number) : []
  if (respostas.length !== perguntas.length || respostas.some((v) => !Number.isInteger(v))) return NextResponse.json({ erro: "Responda todas as perguntas." }, { status: 400 })

  let acertos = 0
  let pontos = 0
  let totalPontos = 0
  const detalhes = perguntas.map((p, i) => {
    const correto = respostas[i] === p.correta
    totalPontos += p.pontos
    if (correto) { acertos += 1; pontos += p.pontos }
    return { perguntaId: p.id, correto, correta: p.correta }
  })

  const resultado = salvarRespostaQuiz({ quiz_id: `${prefixo}${seed}`, usuario_id: usuario.id, respostas, acertos, pontos, total_pontos: totalPontos })
  return NextResponse.json({ ok: true, resultado, detalhes })
}
