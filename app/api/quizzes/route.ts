import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { atualizarQuiz, buscarQuiz, buscarRespostaQuiz, buscarUsuario, excluirQuiz, listarQuizzes, salvarQuiz, type QuizPergunta, type QuizOrigem } from "@/lib/db"

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
    const opcoes = Array.isArray(p.opcoes) ? p.opcoes.map((x) => String(x).trim()).filter(Boolean).slice(0, 3) : []
    return {
      id: String(p.id || `p-${i + 1}`),
      enunciado: String(p.enunciado || "").trim().slice(0, 800),
      opcoes,
      correta: Math.max(0, Math.min(opcoes.length - 1, Number(p.correta) || 0)),
      pontos: Math.max(1, Math.min(100, Number(p.pontos) || 10)),
      explicacao: String(p.explicacao || "").trim().slice(0, 1000) || undefined,
    }
  }).filter((p) => p.enunciado.length >= 3 && p.opcoes.length === 3)
}

export async function GET(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const admin = req.nextUrl.searchParams.get("admin") === "1" && ctx.usuario.tipo === "moderador"
  const quizzes = listarQuizzes(admin)
  if (admin) return NextResponse.json({ quizzes })

  return NextResponse.json({ quizzes: quizzes.map((q) => ({
    id: q.id,
    titulo: q.titulo,
    descricao: q.descricao,
    origem: q.origem,
    data_referencia: q.data_referencia,
    ativo: q.ativo,
    respondido: Boolean(buscarRespostaQuiz(q.id, ctx.usuario.id)),
    perguntas: q.perguntas.map((p) => ({ id: p.id, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos })),
  })) })
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
  const perguntas = limparPerguntas(body.perguntas)
  if (String(body.titulo || "").trim().length < 3 || perguntas.length < 1) return NextResponse.json({ erro: "Informe o título, a pergunta e exatamente três alternativas A, B e C." }, { status: 400 })

  const dados = {
    titulo: String(body.titulo || "").trim().slice(0, 180),
    descricao: String(body.descricao || "").trim().slice(0, 1200),
    origem,
    referencia_id: body.referencia_id ? String(body.referencia_id) : null,
    data_referencia: body.data_referencia ? String(body.data_referencia) : null,
    ativo: body.ativo !== false,
    perguntas,
  }

  const id = String(body.id || "")
  if (id && buscarQuiz(id)) return NextResponse.json({ ok: true, quiz: atualizarQuiz(id, dados) })
  return NextResponse.json({ ok: true, quiz: salvarQuiz({ ...dados, criado_por: ctx.usuario.id }) })
}
