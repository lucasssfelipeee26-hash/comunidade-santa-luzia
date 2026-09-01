import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  buscarUsuario,
  db,
  excluirContaUsuario,
  listarEscalas,
  listarJustificativasEscala,
  listarPontualidadeOcorrencias,
  listarQuizzes,
  listarRankingAjustes,
  listarReconhecimentos,
  listarRespostasQuiz,
  listarTodasPresencasFormacao,
  salvarRankingAjuste,
  type UsuarioRow,
} from "@/lib/db"
import { calcularRanking } from "@/lib/ranking"

function anoCuiaba() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cuiaba", year: "numeric" }).formatToParts(new Date())
  return Number(parts.find((part) => part.type === "year")?.value || new Date().getFullYear())
}

async function moderadorAtual() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || usuario.tipo !== "moderador") return null
  return usuario
}

function cadastros() {
  const rows = db.prepare("SELECT * FROM usuarios WHERE tipo = 'membro' ORDER BY criado_em DESC").all() as UsuarioRow[]
  return rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    usuario: row.usuario,
    email: row.email,
    funcao: row.funcao,
    status: row.status,
    foto: row.foto || null,
    criadoEm: row.criado_em,
  }))
}

function possuiHistoricoUsuario(usuarioId: string) {
  const registros = db.prepare("SELECT * FROM registros WHERE usuario_id = ?").all(usuarioId)
  return (
    registros.length > 0 ||
    listarEscalas().some((escala) => escala.pessoas.some((pessoa) => pessoa.id === usuarioId)) ||
    listarJustificativasEscala().some((item) => item.usuario_id === usuarioId) ||
    listarTodasPresencasFormacao().some((item) => item.usuario_id === usuarioId || item.registrado_por === usuarioId) ||
    listarReconhecimentos().some((item) => item.de_usuario_id === usuarioId || item.para_usuario_id === usuarioId) ||
    listarQuizzes(true).some((item) => item.criado_por === usuarioId) ||
    listarRespostasQuiz().some((item) => item.usuario_id === usuarioId) ||
    listarPontualidadeOcorrencias(true).some((item) => item.usuario_id === usuarioId || item.reportado_por === usuarioId || item.moderado_por === usuarioId) ||
    listarRankingAjustes().some((item) => item.usuario_id === usuarioId || item.criado_por === usuarioId)
  )
}

export async function GET() {
  const moderador = await moderadorAtual()
  if (!moderador) return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  const ano = anoCuiaba()
  const ranking = calcularRanking(ano).ranking
  return NextResponse.json({
    ok: true,
    ano,
    cadastros: cadastros(),
    ranking: ranking.map((row) => ({ usuarioId: row.usuarioId, nome: row.nome, pontos: row.pontos, posicao: row.posicao })),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } })
}

export async function POST(req: NextRequest) {
  const moderador = await moderadorAtual()
  if (!moderador) return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || "")

  if (action === "excluir_cadastro") {
    if (String(body.confirmacao || "").trim().toUpperCase() !== "EXCLUIR") {
      return NextResponse.json({ erro: "Digite EXCLUIR para confirmar." }, { status: 400 })
    }
    const usuarioId = String(body.usuarioId || "")
    const alvo = buscarUsuario(usuarioId)
    if (!alvo || alvo.tipo !== "membro") return NextResponse.json({ erro: "Cadastro de membro não encontrado." }, { status: 404 })
    if (possuiHistoricoUsuario(usuarioId)) {
      return NextResponse.json({ erro: "Este cadastro possui histórico comunitário vinculado e não pode ser excluído sem destruir registros anteriores." }, { status: 409 })
    }
    if (!excluirContaUsuario(usuarioId)) return NextResponse.json({ erro: "Não foi possível excluir o cadastro." }, { status: 409 })
    return NextResponse.json({ ok: true, excluido: { id: alvo.id, nome: alvo.nome }, cadastros: cadastros() })
  }

  if (action === "resetar_ranking") {
    if (String(body.confirmacao || "").trim().toUpperCase() !== "ZERAR") {
      return NextResponse.json({ erro: "Digite ZERAR para confirmar." }, { status: 400 })
    }
    const anoSolicitado = Number(body.ano || anoCuiaba())
    if (!Number.isInteger(anoSolicitado) || anoSolicitado < 2020 || anoSolicitado > 2100) {
      return NextResponse.json({ erro: "Ano inválido." }, { status: 400 })
    }

    const antes = calcularRanking(anoSolicitado).ranking
    const agora = new Date().toISOString()
    let ajustesCriados = 0
    for (const linha of antes) {
      if (!Number.isFinite(linha.pontos) || linha.pontos === 0) continue
      salvarRankingAjuste({
        usuario_id: linha.usuarioId,
        pontos: -linha.pontos,
        motivo: `Reset administrativo do placar em ${agora}`,
        ano: anoSolicitado,
        criado_por: moderador.id,
      })
      ajustesCriados += 1
    }
    const depois = calcularRanking(anoSolicitado).ranking
    return NextResponse.json({
      ok: true,
      ano: anoSolicitado,
      ajustesCriados,
      ranking: depois.map((row) => ({ usuarioId: row.usuarioId, nome: row.nome, pontos: row.pontos, posicao: row.posicao })),
    })
  }

  return NextResponse.json({ erro: "Ação administrativa desconhecida." }, { status: 400 })
}
