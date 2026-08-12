import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { atualizarQuiz, buscarQuiz, buscarRespostaQuiz, buscarUsuario, excluirQuiz, listarQuizzes, salvarQuiz, type QuizPergunta, type QuizOrigem } from "@/lib/db"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"
import { garantirQuizLiturgiaOffline } from "@/lib/quiz-liturgia-offline"

async function contexto() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return { usuario }
}

function limparPerguntas(input: unknown): QuizPergunta[] {
  if (!Array.isArray(input)) return []
  return input.slice(0, 30).map((raw, i) => {
    const p = (raw || {}) as Record<string, unknown>
    const opcoes = Array.isArray(p.opcoes) ? p.opcoes.map((x) => String(x).trim()).slice(0, 3) : []
    const corretaRaw = Number(p.correta)
    const correta = Number.isInteger(corretaRaw) && corretaRaw >= 0 && corretaRaw < 3 ? corretaRaw : -1
    return {
      id: String(p.id || `p-${i + 1}`),
      enunciado: String(p.enunciado || "").trim().slice(0, 800),
      opcoes,
      correta,
      pontos: Math.max(1, Math.min(100, Number(p.pontos) || 10)),
      explicacao: String(p.explicacao || "").trim().slice(0, 1000) || undefined,
    }
  }).filter((p) => p.enunciado.length >= 3 && p.opcoes.length === 3 && p.opcoes.every(Boolean) && p.correta >= 0)
}

export async function GET(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const hoje = dataCuiabaIso()
  const liturgiaHoje = obterLiturgiaLocal(hoje)
  if (liturgiaHoje) garantirQuizLiturgiaOffline(hoje)

  const admin = req.nextUrl.searchParams.get("admin") === "1" && ctx.usuario.tipo === "moderador"
  let quizzes = listarQuizzes(admin)

  // Um Quiz Litúrgico só existe para o usuário quando a Liturgia da mesma data existe offline.
  quizzes = quizzes.filter((q) => q.origem !== "liturgia" || Boolean(q.data_referencia && obterLiturgiaLocal(q.data_referencia)))
  if (!admin) quizzes = quizzes.filter((q) => q.origem !== "liturgia" || q.data_referencia === hoje)

  if (admin) return NextResponse.json({ quizzes, liturgiaOfflineHoje: Boolean(liturgiaHoje), dataLiturgia: liturgiaHoje ? hoje : null })

  return NextResponse.json({
    quizzes: quizzes.map((q) => ({
      id: q.id,
      titulo: q.titulo,
      descricao: q.descricao,
      origem: q.origem,
      data_referencia: q.data_referencia,
      ativo: q.ativo,
      respondido: Boolean(buscarRespostaQuiz(q.id, ctx.usuario.id)),
      perguntas: q.perguntas.map((p) => ({ id: p.id, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos })),
    })),
    liturgiaOfflineHoje: Boolean(liturgiaHoje),
    dataLiturgia: liturgiaHoje ? hoje : null,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx || ctx.usuario.tipo !== "moderador") return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || "salvar")

  if (action === "excluir") {
    const ok = excluirQuiz(String(body.id || ""))
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erro: "Quiz não encontrado." }, { status: 404 })
  }

  const origem = String(body.origem || "manual") as QuizOrigem
  if (!["formacao", "liturgia", "manual"].includes(origem)) return NextResponse.json({ erro: "Origem inválida." }, { status: 400 })

  const dataReferencia = body.data_referencia ? String(body.data_referencia) : null
  if (origem === "liturgia" && (!dataReferencia || !obterLiturgiaLocal(dataReferencia))) {
    return NextResponse.json({ erro: "Não é permitido publicar Quiz Litúrgico sem a Liturgia offline da mesma data." }, { status: 400 })
  }

  const perguntas = limparPerguntas(body.perguntas)
  if (String(body.titulo || "").trim().length < 3 || perguntas.length < 1) {
    return NextResponse.json({ erro: "Informe o título, a pergunta, as alternativas A/B/C e marque exatamente uma alternativa como Verdadeira." }, { status: 400 })
  }

  const dados = {
    titulo: String(body.titulo || "").trim().slice(0, 180),
    descricao: String(body.descricao || "").trim().slice(0, 1200),
    origem,
    referencia_id: origem === "liturgia" ? `liturgia-offline:${dataReferencia}` : (body.referencia_id ? String(body.referencia_id) : null),
    data_referencia: dataReferencia,
    ativo: body.ativo !== false,
    perguntas,
  }

  const id = String(body.id || "")
  if (id && buscarQuiz(id)) return NextResponse.json({ ok: true, quiz: atualizarQuiz(id, dados) })
  return NextResponse.json({ ok: true, quiz: salvarQuiz({ ...dados, criado_por: ctx.usuario.id }) })
}
