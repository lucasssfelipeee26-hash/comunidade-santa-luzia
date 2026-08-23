import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { atualizarEscala, buscarEscala, buscarUsuario, excluirEscala, type EscalaPessoa } from "@/lib/db"
import { funcaoEscalaValida } from "@/lib/escala-funcoes"
import { dataCivilIsoValida, horario24hValido } from "@/lib/validation"

function normalizarCelebrante(valor: string) {
  const nome = valor.trim().replace(/\s+/g, " ")
  return /^(padre|pe\.?|frei|dom)\s/i.test(nome) ? nome.replace(/^pe\.?\s+/i, "Padre ") : `Padre ${nome}`
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") return NextResponse.json({ ok: false, erro: "Acesso exclusivo do moderador." }, { status: 403 })
  const windowsBeta = /SantaLuziaWindowsBeta\//.test(request.headers.get("user-agent") || "") || request.headers.get("x-santa-luzia-windows-beta") === "1"
  if (!windowsBeta) return NextResponse.json({ ok: false, erro: "Edição disponível somente na Beta Windows." }, { status: 403 })
  const { id } = await params
  if (!id || id.length > 160 || !buscarEscala(id)) return NextResponse.json({ ok: false, erro: "Escala não encontrada." }, { status: 404 })

  const body = await request.json().catch(() => null) as {
    data?: unknown; horario?: unknown; celebrante?: unknown; observacoes?: unknown
    celebracaoLiturgica?: unknown; tempoLiturgico?: unknown; corLiturgica?: unknown; cicloDominical?: unknown; dataLiturgica?: unknown
    pessoas?: Array<{ id?: unknown; categoria?: unknown; funcao?: unknown }>
  } | null
  const data = String(body?.data ?? "").trim()
  const horario = String(body?.horario ?? "").trim()
  const celebranteBruto = String(body?.celebrante ?? "").trim()
  const celebrante = celebranteBruto ? normalizarCelebrante(celebranteBruto) : ""
  const observacoes = String(body?.observacoes ?? "").trim()
  const celebracaoLiturgica = String(body?.celebracaoLiturgica ?? "").trim().replace(/\s+/g, " ")
  const tempoLiturgico = String(body?.tempoLiturgico ?? "").trim().replace(/\s+/g, " ")
  const corLiturgica = String(body?.corLiturgica ?? "").trim().replace(/\s+/g, " ")
  const cicloDominical = String(body?.cicloDominical ?? "").trim().replace(/\s+/g, " ")
  const dataLiturgica = String(body?.dataLiturgica ?? "").trim()
  if (!dataCivilIsoValida(data, { anoMinimo: 2020, anoMaximo: 2100 }) || !horario24hValido(horario)) return NextResponse.json({ ok: false, erro: "Data ou horário inválido." }, { status: 400 })
  if (celebrante.length < 8 || celebrante.length > 120) return NextResponse.json({ ok: false, erro: "Informe o sacerdote celebrante." }, { status: 400 })
  if (observacoes.length > 1200 || [celebracaoLiturgica, tempoLiturgico, corLiturgica, cicloDominical].some((valor) => valor.length > 180)) return NextResponse.json({ ok: false, erro: "Há informações maiores que o permitido." }, { status: 400 })
  if (dataLiturgica && !dataCivilIsoValida(dataLiturgica, { anoMinimo: 2020, anoMaximo: 2100 })) return NextResponse.json({ ok: false, erro: "Data litúrgica inválida." }, { status: 400 })

  const pessoas: EscalaPessoa[] = []
  const ids = new Set<string>()
  const funcoes = new Set<string>()
  for (const item of Array.isArray(body?.pessoas) ? body.pessoas : []) {
    const usuarioId = String(item.id ?? "").trim()
    const usuario = buscarUsuario(usuarioId)
    if (!usuario || usuario.status !== "aprovado" || (usuario.funcao !== "Acólito" && usuario.funcao !== "Coroinha") || ids.has(usuarioId)) continue
    const categoria: EscalaPessoa["categoria"] = usuario.funcao === "Acólito" ? "acolito" : "coroinha"
    const funcao = String(item.funcao ?? "").trim()
    if (String(item.categoria ?? "") !== categoria || !funcaoEscalaValida(funcao)) return NextResponse.json({ ok: false, erro: `Dados inválidos na escala de ${usuario.nome}.` }, { status: 400 })
    if (funcoes.has(funcao)) return NextResponse.json({ ok: false, erro: `A função ${funcao} foi repetida.` }, { status: 400 })
    ids.add(usuarioId); funcoes.add(funcao)
    pessoas.push({ id: usuario.id, nome: usuario.nome, categoria, funcao })
  }

  const escala = atualizarEscala(id, { data, horario, celebrante, observacoes, pessoas, celebracao_liturgica: celebracaoLiturgica || null, tempo_liturgico: tempoLiturgico || null, cor_liturgica: corLiturgica || null, ciclo_dominical: cicloDominical || null, data_liturgica: dataLiturgica || null })
  return NextResponse.json({ ok: true, escala })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 403 })
  }

  const { id } = await params
  if (!id || id.length > 160) {
    return NextResponse.json({ ok: false, erro: "Escala inválida." }, { status: 400 })
  }

  if (!excluirEscala(id)) {
    return NextResponse.json({ ok: false, erro: "Escala não encontrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
