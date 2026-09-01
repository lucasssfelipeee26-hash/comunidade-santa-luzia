import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { atualizarQuiz, buscarQuiz, buscarRespostaQuiz, buscarUsuario, excluirQuiz, listarMembrosAprovados, listarQuizzes, listarRespostasQuiz, salvarQuiz, type QuizPergunta, type QuizOrigem } from "@/lib/db"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"
import { garantirQuizLiturgiaOffline } from "@/lib/quiz-liturgia-offline"
import { notificarUsuarios } from "@/lib/notificacoes"
import { dataCivilIsoValida } from "@/lib/validation"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

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
    const opcoes = Array.isArray(p.opcoes)
      ? p.opcoes.map((x) => String(x).trim().slice(0, 500)).slice(0, 3)
      : []
    const corretaRaw = Number(p.correta)
    const correta = Number.isInteger(corretaRaw) && corretaRaw >= 0 && corretaRaw < 3 ? corretaRaw : -1
    const pontosRaw = Number(p.pontos)
    const pontos = Number.isFinite(pontosRaw) ? Math.max(1, Math.min(100, Math.trunc(pontosRaw))) : 10
    return {
      id: String(p.id || `p-${i + 1}`).trim().slice(0, 120),
      enunciado: String(p.enunciado || "").trim().slice(0, 800),
      opcoes,
      correta,
      pontos,
      explicacao: String(p.explicacao || "").trim().slice(0, 1000) || undefined,
    }
  }).filter((p) => p.id.length > 0 && p.enunciado.length >= 3 && p.opcoes.length === 3 && p.opcoes.every(Boolean) && p.correta >= 0)
}

function notificarQuizAvulso(quiz: { id: string; titulo: string; descricao: string; origem: QuizOrigem }) {
  if (quiz.origem === "liturgia") return
  const ids = listarMembrosAprovados().map((m) => m.id)
  if (!ids.length) return
  notificarUsuarios(ids, {
    chave: `quiz-avulso:${quiz.id}`,
    tipo: "avulso",
    titulo: "Novo quiz avulso disponível",
    mensagem: quiz.descricao ? `${quiz.titulo} · ${quiz.descricao}` : quiz.titulo,
    href: "/area-restrita/ranking?aba=avulsos",
  })
}

export async function GET(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const hoje = dataCuiabaIso()
  const liturgiaHoje = obterLiturgiaLocal(hoje)
  if (liturgiaHoje) garantirQuizLiturgiaOffline(hoje)

  const admin = req.nextUrl.searchParams.get("admin") === "1" && ctx.usuario.tipo === "moderador"
  let quizzes = listarQuizzes(admin)
  quizzes = quizzes.filter((q) => q.origem !== "liturgia" || Boolean(q.data_referencia && obterLiturgiaLocal(q.data_referencia)))
  if (!admin) quizzes = quizzes.filter((q) => q.origem !== "liturgia" || q.data_referencia === hoje)

  if (admin) return NextResponse.json({ quizzes, liturgiaOfflineHoje: Boolean(liturgiaHoje), dataLiturgia: liturgiaHoje ? hoje : null }, { headers: { "Cache-Control": "no-store" } })

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
  }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx || ctx.usuario.tipo !== "moderador") return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })

  const limite = limitar(`quiz:admin:${ctx.usuario.id}:${ipDaRequisicao(req)}`, 60, 60 * 60 * 1000)
  if (!limite.permitido) return NextResponse.json({ erro: "Muitas alterações de quiz em pouco tempo. Aguarde antes de tentar novamente." }, { status: 429 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || "salvar")
  if (action !== "salvar" && action !== "excluir") return NextResponse.json({ erro: "Ação inválida." }, { status: 400 })

  if (action === "excluir") {
    const id = String(body.id || "").trim()
    if (!id || id.length > 180) return NextResponse.json({ erro: "Quiz inválido." }, { status: 400 })
    const existente = buscarQuiz(id)
    if (!existente) return NextResponse.json({ erro: "Quiz não encontrado." }, { status: 404 })
    if (listarRespostasQuiz().some((resposta) => resposta.quiz_id === id)) {
      return NextResponse.json({ erro: "Este quiz já possui respostas e faz parte do histórico. Desative-o em vez de excluí-lo." }, { status: 409 })
    }
    const ok = excluirQuiz(id)
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erro: "Quiz não encontrado." }, { status: 404 })
  }

  const origem = String(body.origem || "manual") as QuizOrigem
  if (!["formacao", "liturgia", "manual"].includes(origem)) return NextResponse.json({ erro: "Origem inválida." }, { status: 400 })

  const dataReferencia = body.data_referencia ? String(body.data_referencia).trim() : null
  if (dataReferencia && !dataCivilIsoValida(dataReferencia, { anoMinimo: 2020, anoMaximo: 2100 })) {
    return NextResponse.json({ erro: "Data de referência inválida." }, { status: 400 })
  }
  if (origem === "liturgia" && (!dataReferencia || !obterLiturgiaLocal(dataReferencia))) {
    return NextResponse.json({ erro: "Não é permitido publicar Quiz Litúrgico sem a Liturgia offline da mesma data." }, { status: 400 })
  }

  const perguntas = limparPerguntas(body.perguntas)
  const titulo = String(body.titulo || "").trim()
  if (titulo.length < 3 || titulo.length > 180 || perguntas.length < 1) {
    return NextResponse.json({ erro: "Informe um título válido e pelo menos uma pergunta completa com alternativas A/B/C." }, { status: 400 })
  }

  const referenciaRecebida = body.referencia_id ? String(body.referencia_id).trim() : ""
  if (referenciaRecebida.length > 300) return NextResponse.json({ erro: "Referência do quiz muito longa." }, { status: 400 })

  const dados = {
    titulo,
    descricao: String(body.descricao || "").trim().slice(0, 1200),
    origem,
    referencia_id: origem === "liturgia" ? `liturgia-offline:${dataReferencia}` : (referenciaRecebida || null),
    data_referencia: dataReferencia,
    ativo: body.ativo !== false,
    perguntas,
  }

  const id = String(body.id || "").trim()
  if (id.length > 180) return NextResponse.json({ erro: "Identificador de quiz inválido." }, { status: 400 })
  if (id) {
    const existente = buscarQuiz(id)
    if (existente) {
      const eraAtivo = existente.ativo
      const possuiRespostas = listarRespostasQuiz().some((resposta) => resposta.quiz_id === id)
      if (possuiRespostas) {
        const estruturaIgual =
          existente.titulo === dados.titulo &&
          existente.descricao === dados.descricao &&
          existente.origem === dados.origem &&
          existente.referencia_id === dados.referencia_id &&
          existente.data_referencia === dados.data_referencia &&
          JSON.stringify(existente.perguntas) === JSON.stringify(dados.perguntas)
        if (!estruturaIgual) {
          return NextResponse.json({ erro: "Este quiz já possui respostas. Perguntas, pontuação e conteúdo histórico não podem mais ser alterados." }, { status: 409 })
        }
        const quiz = atualizarQuiz(id, { ativo: dados.ativo })
        if (quiz?.ativo && !eraAtivo) notificarQuizAvulso(quiz)
        return NextResponse.json({ ok: true, quiz })
      }

      const quiz = atualizarQuiz(id, dados)
      if (quiz?.ativo && !eraAtivo) notificarQuizAvulso(quiz)
      return NextResponse.json({ ok: true, quiz })
    }
  }

  const quiz = salvarQuiz({ ...dados, criado_por: ctx.usuario.id })
  if (quiz.ativo) notificarQuizAvulso(quiz)
  return NextResponse.json({ ok: true, quiz })
}
