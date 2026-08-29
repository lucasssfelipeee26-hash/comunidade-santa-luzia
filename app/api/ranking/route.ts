import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  buscarPontualidadeOcorrencia,
  buscarPontualidadePorRequisicao,
  buscarUsuario,
  listarMembrosAprovados,
  listarPontualidadeOcorrencias,
  listarPontualidadeReacoes,
  listarEscalas,
  moderarPontualidade,
  obterRankingConfig,
  reconhecimentoMensalJaFeito,
  salvarPontualidadeOcorrencia,
  salvarPontualidadeReacao,
  salvarRankingAjuste,
  salvarRankingConfig,
  salvarReconhecimento,
  type ReconhecimentoCategoria,
} from "@/lib/db"
import { calcularRanking } from "@/lib/ranking"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"
import { anoOperacionalValido, dataCivilIsoValida, horario24hValido } from "@/lib/validation"

const categorias: ReconhecimentoCategoria[] = ["companheirismo", "acolhimento", "espirito_servico", "disponibilidade"]
const emojisPermitidos = ["⏰", "😅", "🙏", "✝️", "💛"]

function nowCuiaba() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cuiaba", year: "numeric", month: "numeric" }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0)
  return { ano: get("year"), mes: get("month") }
}

function calcularLimite(horario: string, minutosAntes: number) {
  const [h, m] = horario.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return horario
  let total = h * 60 + m - minutosAntes
  while (total < 0) total += 24 * 60
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

async function contexto() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return { sessao, usuario }
}

function membroLiturgicoAprovado(id: string) {
  const usuario = buscarUsuario(id)
  return usuario && usuario.status === "aprovado" && (usuario.funcao === "Acólito" || usuario.funcao === "Coroinha") ? usuario : null
}

export async function GET(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const anoParam = Number(req.nextUrl.searchParams.get("ano"))
  const ano = anoOperacionalValido(anoParam) ? anoParam : nowCuiaba().ano
  const { config, ranking } = calcularRanking(ano)
  const membros = listarMembrosAprovados().map((m) => ({ id: m.id, nome: m.nome, funcao: m.funcao, foto: m.foto || null }))

  // O atraso individual é um registro privado. A pontuação agregada do ranking pode
  // considerar atrasos confirmados, mas o detalhe do relato só é devolvido para a
  // moderação e para os dois membros diretamente envolvidos no relato.
  const todasOcorrencias = listarPontualidadeOcorrencias(true)
  const ocorrenciasVisiveis = todasOcorrencias.filter((o) =>
    ctx.usuario.tipo === "moderador" ||
    o.usuario_id === ctx.usuario.id ||
    o.reportado_por === ctx.usuario.id
  )
  const idsVisiveis = new Set(ocorrenciasVisiveis.map((o) => o.id))
  const ocorrencias = ocorrenciasVisiveis.map((o) => ({
    id: o.id,
    usuario_id: o.usuario_id,
    usuario_nome: buscarUsuario(o.usuario_id)?.nome || "Membro",
    escala_id: o.escala_id,
    data_missa: o.data_missa,
    horario_missa: o.horario_missa,
    limite_chegada: o.limite_chegada,
    observacao: o.observacao,
    status: o.status,
    criado_em: o.criado_em,
    reportado_por: o.reportado_por,
    reportado_por_nome: o.reportado_por ? (buscarUsuario(o.reportado_por)?.nome || "Membro") : null,
  }))
  const reacoes = listarPontualidadeReacoes()
    .filter((r) => idsVisiveis.has(r.ocorrencia_id))
    .map((r) => ({ ocorrencia_id: r.ocorrencia_id, emoji: r.emoji }))

  return NextResponse.json({
    ano,
    eu: { id: ctx.usuario.id, nome: ctx.usuario.nome, tipo: ctx.usuario.tipo },
    config,
    ranking,
    membros,
    ocorrencias,
    reacoes,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await contexto()
  if (!ctx) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || "")

  if (action === "reconhecer") {
    const limite = limitar(`ranking:reconhecer:${ctx.usuario.id}:${ipDaRequisicao(req)}`, 30, 60 * 60 * 1000)
    if (!limite.permitido) return NextResponse.json({ erro: "Muitas tentativas de reconhecimento. Tente novamente mais tarde." }, { status: 429 })

    const paraId = String(body.paraId || "")
    const categoria = String(body.categoria || "") as ReconhecimentoCategoria
    if (!categorias.includes(categoria)) return NextResponse.json({ erro: "Categoria inválida." }, { status: 400 })
    if (paraId === ctx.usuario.id) return NextResponse.json({ erro: "Você não pode reconhecer o próprio perfil." }, { status: 400 })
    const alvo = membroLiturgicoAprovado(paraId)
    if (!alvo) return NextResponse.json({ erro: "Perfil inválido." }, { status: 404 })
    const { ano, mes } = nowCuiaba()
    if (reconhecimentoMensalJaFeito(ctx.usuario.id, categoria, ano, mes)) {
      return NextResponse.json({ erro: "Você já usou este reconhecimento neste mês. Cada categoria pode ser concedida uma vez por mês." }, { status: 409 })
    }
    const row = salvarReconhecimento({ de_usuario_id: ctx.usuario.id, para_usuario_id: paraId, categoria, ano, mes })
    return NextResponse.json({ ok: true, reconhecimento: row })
  }

  if (action === "reportar_atraso") {
    const limite = limitar(`ranking:atraso:${ctx.usuario.id}:${ipDaRequisicao(req)}`, 20, 60 * 60 * 1000)
    if (!limite.permitido) return NextResponse.json({ erro: "Muitos relatos enviados em pouco tempo. Aguarde antes de tentar novamente." }, { status: 429 })

    const usuarioId = String(body.usuarioId || "")
    const escalaId = body.escalaId ? String(body.escalaId) : null
    const clientRequestId = String(body.clientRequestId || "").trim()
    if (usuarioId === ctx.usuario.id) {
      return NextResponse.json({ erro: "O atraso deve ser reportado por um colega." }, { status: 400 })
    }
    if (clientRequestId && !/^[a-zA-Z0-9._:-]{8,100}$/.test(clientRequestId)) {
      return NextResponse.json({ erro: "Identificador do relato inválido." }, { status: 400 })
    }

    if (clientRequestId) {
      const jaRecebido = buscarPontualidadePorRequisicao(clientRequestId, ctx.usuario.id)
      if (jaRecebido) {
        return NextResponse.json({ ok: true, ocorrencia: jaRecebido, duplicado: true, mensagem: "Relato já sincronizado." })
      }
    }

    const alvo = membroLiturgicoAprovado(usuarioId)
    if (!alvo) return NextResponse.json({ erro: "Perfil inválido." }, { status: 404 })

    const escala = escalaId ? listarEscalas().find((e) => e.id === escalaId) : undefined
    if (escalaId && !escala) return NextResponse.json({ erro: "Escala não encontrada." }, { status: 404 })
    if (escala && !escala.pessoas.some((p) => p.id === usuarioId)) {
      return NextResponse.json({ erro: "Este perfil não está incluído na escala informada." }, { status: 409 })
    }

    const dataMissa = escala ? escala.data : String(body.dataMissa || "")
    const horarioMissa = escala ? escala.horario : String(body.horarioMissa || "18:00")
    if (!dataCivilIsoValida(dataMissa, { anoMinimo: 2020, anoMaximo: 2100 }) || !horario24hValido(horarioMissa)) {
      return NextResponse.json({ erro: "Data ou horário inválido." }, { status: 400 })
    }

    const existente = listarPontualidadeOcorrencias(true).some((o) => o.usuario_id === usuarioId && o.data_missa === dataMissa && o.status !== "rejeitado")
    if (existente) return NextResponse.json({ erro: "Já existe um relato de pontualidade para este perfil nesta data." }, { status: 409 })
    const ano = Number(dataMissa.slice(0, 4))
    const config = obterRankingConfig(ano)
    const row = salvarPontualidadeOcorrencia({
      client_request_id: clientRequestId || null,
      usuario_id: usuarioId,
      escala_id: escalaId,
      data_missa: dataMissa,
      horario_missa: horarioMissa,
      limite_chegada: calcularLimite(horarioMissa, config.minutos_antecedencia),
      observacao: String(body.observacao || "").trim().slice(0, 300),
      reportado_por: ctx.usuario.id,
    })
    return NextResponse.json({ ok: true, ocorrencia: row, mensagem: "Relato enviado ao moderador para confirmação." })
  }

  if (action === "reagir") {
    const limite = limitar(`ranking:reagir:${ctx.usuario.id}:${ipDaRequisicao(req)}`, 90, 60 * 60 * 1000)
    if (!limite.permitido) return NextResponse.json({ erro: "Muitas reações em pouco tempo. Aguarde antes de tentar novamente." }, { status: 429 })

    const ocorrenciaId = String(body.ocorrenciaId || "")
    const emoji = String(body.emoji || "")
    if (!emojisPermitidos.includes(emoji)) return NextResponse.json({ erro: "Reação inválida." }, { status: 400 })
    const ocorrencia = buscarPontualidadeOcorrencia(ocorrenciaId)
    if (!ocorrencia || ocorrencia.status !== "confirmado") return NextResponse.json({ erro: "Ocorrência não disponível para reações." }, { status: 404 })
    const podeVerOcorrencia = ctx.usuario.tipo === "moderador" || ocorrencia.usuario_id === ctx.usuario.id || ocorrencia.reportado_por === ctx.usuario.id
    if (!podeVerOcorrencia) return NextResponse.json({ erro: "Ocorrência não disponível para este perfil." }, { status: 403 })
    return NextResponse.json({ ok: true, reacao: salvarPontualidadeReacao(ocorrenciaId, ctx.usuario.id, emoji) })
  }

  if (action === "moderar_atraso") {
    if (ctx.usuario.tipo !== "moderador") return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })
    const ocorrenciaId = String(body.ocorrenciaId || "")
    const status = String(body.status || "")
    if (status !== "confirmado" && status !== "rejeitado") return NextResponse.json({ erro: "Status inválido." }, { status: 400 })
    const row = moderarPontualidade(ocorrenciaId, status, ctx.usuario.id)
    if (!row) return NextResponse.json({ erro: "Ocorrência não encontrada." }, { status: 404 })
    return NextResponse.json({ ok: true, ocorrencia: row })
  }

  if (action === "ajustar_pontos") {
    if (ctx.usuario.tipo !== "moderador") return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })
    const usuarioId = String(body.usuarioId || "")
    const pontos = Number(body.pontos)
    const motivo = String(body.motivo || "").trim()
    const ano = Number(body.ano)
    const alvo = membroLiturgicoAprovado(usuarioId)
    if (!alvo || !Number.isFinite(pontos) || !Number.isInteger(pontos) || pontos < -100 || pontos > 100 || motivo.length < 3 || motivo.length > 300 || !anoOperacionalValido(ano)) {
      return NextResponse.json({ erro: "Dados inválidos para o ajuste." }, { status: 400 })
    }
    return NextResponse.json({ ok: true, ajuste: salvarRankingAjuste({ usuario_id: usuarioId, pontos, motivo, ano, criado_por: ctx.usuario.id }) })
  }

  if (action === "salvar_config") {
    if (ctx.usuario.tipo !== "moderador") return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })
    const ano = Number(body.ano)
    const peso_formacao = Number(body.peso_formacao)
    const peso_liturgia = Number(body.peso_liturgia)
    const peso_pontualidade = Number(body.peso_pontualidade)
    const peso_reconhecimento = Number(body.peso_reconhecimento)
    const minutos_antecedencia = Number(body.minutos_antecedencia)
    const pesos = [peso_formacao, peso_liturgia, peso_pontualidade, peso_reconhecimento]
    if (!anoOperacionalValido(ano) || pesos.some((p) => !Number.isFinite(p) || p < 0 || p > 100) || Math.round(pesos.reduce((a,b)=>a+b,0)) !== 100 || !Number.isFinite(minutos_antecedencia) || !Number.isInteger(minutos_antecedencia) || minutos_antecedencia < 10 || minutos_antecedencia > 120) {
      return NextResponse.json({ erro: "Os pesos devem totalizar 100 e a antecedência deve ficar entre 10 e 120 minutos." }, { status: 400 })
    }
    const config = salvarRankingConfig({ ano, peso_formacao, peso_liturgia, peso_pontualidade, peso_reconhecimento, minutos_antecedencia, atualizado_em: Date.now() })
    return NextResponse.json({ ok: true, config })
  }

  return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 })
}
