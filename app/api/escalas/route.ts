import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarJustificativaEscala, listarEscalas, salvarEscala, buscarUsuario, listarMembrosAprovados, type EscalaPessoa, type EscalaRow } from "@/lib/db"
import { funcaoEscalaValida } from "@/lib/escala-funcoes"
import { notificarUsuarios } from "@/lib/notificacoes"
import { dataCivilIsoValida, horario24hValido } from "@/lib/validation"

export const dynamic = "force-dynamic"

type EscalaIdempotente = EscalaRow & {
  client_request_id?: string | null
  client_request_fingerprint?: string | null
  criado_por?: string | null
}

function normalizarCelebrante(valor: string) {
  const nome = valor.trim().replace(/\s+/g, " ")
  return /^(padre|pe\.?|frei|dom)\s/i.test(nome) ? nome.replace(/^pe\.?\s+/i, "Padre ") : `Padre ${nome}`
}

function escalaPublica(escala: EscalaIdempotente) {
  const { client_request_id: _requestId, client_request_fingerprint: _fingerprint, criado_por: _criadoPor, ...publica } = escala
  return publica
}

function fingerprintEscala(valor: {
  data: string
  horario: string
  celebrante: string
  observacoes: string
  celebracaoLiturgica: string
  tempoLiturgico: string
  corLiturgica: string
  cicloDominical: string
  dataLiturgica: string
  pessoas: EscalaPessoa[]
}) {
  const canonico = {
    data: valor.data,
    horario: valor.horario,
    celebrante: valor.celebrante,
    observacoes: valor.observacoes,
    celebracaoLiturgica: valor.celebracaoLiturgica,
    tempoLiturgico: valor.tempoLiturgico,
    corLiturgica: valor.corLiturgica,
    cicloDominical: valor.cicloDominical,
    dataLiturgica: valor.dataLiturgica,
    pessoas: valor.pessoas
      .map((pessoa) => ({ id: pessoa.id || "", categoria: pessoa.categoria, funcao: pessoa.funcao }))
      .sort((a, b) => `${a.id}|${a.funcao}`.localeCompare(`${b.id}|${b.funcao}`)),
  }
  return createHash("sha256").update(JSON.stringify(canonico)).digest("hex")
}

export async function GET(request: Request) {
  const sessao = await lerSessao()
  const windowsBeta = /SantaLuziaWindowsBeta\//.test(request.headers.get("user-agent") || "") || request.headers.get("x-santa-luzia-windows-beta") === "1"
  const escalas = (listarEscalas() as EscalaIdempotente[]).map((escalaInterna) => {
    const escala = escalaPublica(escalaInterna)
    return {
      ...escala,
      celebrante: windowsBeta && escala.celebrante ? normalizarCelebrante(escala.celebrante) : escala.celebrante,
      minha_justificativa: sessao ? buscarJustificativaEscala(escala.id, sessao.sub) ?? null : null,
    }
  })
  return NextResponse.json(
    { ok: true, escalas, usuarioId: sessao?.sub ?? null, tipoUsuario: sessao?.tipo ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}

export async function POST(req: Request) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json(
      { ok: false, erro: "Apenas moderadores podem publicar escalas." },
      { status: 403 },
    )
  }

  const windowsBeta = /SantaLuziaWindowsBeta\//.test(req.headers.get("user-agent") || "") || req.headers.get("x-santa-luzia-windows-beta") === "1"
  const body = await req.json().catch(() => null) as {
    data?: string
    horario?: string
    celebrante?: string
    observacoes?: string
    celebracaoLiturgica?: string
    tempoLiturgico?: string
    corLiturgica?: string
    cicloDominical?: string
    dataLiturgica?: string
    pessoas?: Array<{ id?: string; categoria?: string; funcao?: string }>
    clientRequestId?: unknown
  } | null

  const clientRequestId = String(body?.clientRequestId ?? "").trim()
  if (clientRequestId && !/^[A-Za-z0-9._:-]{8,120}$/.test(clientRequestId)) {
    return NextResponse.json({ ok: false, erro: "Identificador da publicação inválido." }, { status: 400 })
  }

  const data = String(body?.data ?? "").trim()
  const horario = String(body?.horario ?? "").trim()
  const celebranteBruto = String(body?.celebrante ?? "").trim().replace(/\s+/g, " ")
  const celebrante = celebranteBruto ? (windowsBeta ? normalizarCelebrante(celebranteBruto) : celebranteBruto) : ""
  const observacoes = String(body?.observacoes ?? "").trim()
  const celebracaoLiturgica = String(body?.celebracaoLiturgica ?? "").trim().replace(/\s+/g, " ")
  const tempoLiturgico = String(body?.tempoLiturgico ?? "").trim().replace(/\s+/g, " ")
  const corLiturgica = String(body?.corLiturgica ?? "").trim().replace(/\s+/g, " ")
  const cicloDominical = String(body?.cicloDominical ?? "").trim().replace(/\s+/g, " ")
  const dataLiturgica = String(body?.dataLiturgica ?? "").trim()

  if (!dataCivilIsoValida(data, { anoMinimo: 2020, anoMaximo: 2100 })) {
    return NextResponse.json({ ok: false, erro: "Informe uma data válida para a escala." }, { status: 400 })
  }
  if (!horario24hValido(horario)) {
    return NextResponse.json({ ok: false, erro: "Informe um horário válido entre 00:00 e 23:59." }, { status: 400 })
  }
  if (celebrante.length < 2 || celebrante.length > 120) {
    return NextResponse.json({ ok: false, erro: "Informe o sacerdote celebrante com até 120 caracteres." }, { status: 400 })
  }
  if (observacoes.length > 1200) {
    return NextResponse.json({ ok: false, erro: "As observações devem ter no máximo 1.200 caracteres." }, { status: 400 })
  }
  if ([celebracaoLiturgica, tempoLiturgico, corLiturgica, cicloDominical].some((valor) => valor.length > 180)) {
    return NextResponse.json({ ok: false, erro: "As informações litúrgicas excedem o tamanho permitido." }, { status: 400 })
  }
  if (dataLiturgica && !dataCivilIsoValida(dataLiturgica, { anoMinimo: 2020, anoMaximo: 2100 })) {
    return NextResponse.json({ ok: false, erro: "A data da celebração litúrgica é inválida." }, { status: 400 })
  }
  if (Array.isArray(body?.pessoas) && body.pessoas.length > 80) {
    return NextResponse.json({ ok: false, erro: "A escala possui pessoas demais para uma única celebração." }, { status: 400 })
  }

  const pessoas: EscalaPessoa[] = []
  const idsUsados = new Set<string>()
  const funcoesUsadas = new Set<string>()

  for (const pessoa of Array.isArray(body?.pessoas) ? body.pessoas : []) {
    const id = String(pessoa.id ?? "").trim()
    if (!id || idsUsados.has(id)) continue

    const usuario = buscarUsuario(id)
    if (
      !usuario ||
      usuario.status !== "aprovado" ||
      (usuario.funcao !== "Acólito" && usuario.funcao !== "Coroinha")
    ) continue

    const categoria: EscalaPessoa["categoria"] = usuario.funcao === "Acólito" ? "acolito" : "coroinha"
    if (pessoa.categoria !== categoria) {
      const bloco = categoria === "acolito" ? "Acólitos" : "Coroinhas"
      return NextResponse.json(
        { ok: false, erro: `${usuario.nome} está cadastrado como ${usuario.funcao.toLowerCase()} e só pode ser incluído em ${bloco}.` },
        { status: 400 },
      )
    }

    const funcao = String(pessoa.funcao ?? "").trim()
    if (!funcaoEscalaValida(funcao)) continue
    if (funcoesUsadas.has(funcao)) {
      return NextResponse.json(
        { ok: false, erro: `A função ${funcao} foi atribuída a mais de uma pessoa.` },
        { status: 400 },
      )
    }

    idsUsados.add(id)
    funcoesUsadas.add(funcao)
    pessoas.push({ id: usuario.id, nome: usuario.nome, funcao, categoria })
  }

  const fingerprint = fingerprintEscala({
    data,
    horario,
    celebrante,
    observacoes,
    celebracaoLiturgica,
    tempoLiturgico,
    corLiturgica,
    cicloDominical,
    dataLiturgica,
    pessoas,
  })

  if (clientRequestId) {
    const existente = (listarEscalas() as EscalaIdempotente[]).find((escala) =>
      escala.criado_por === sessao.sub && escala.client_request_id === clientRequestId
    )
    if (existente) {
      if (existente.client_request_fingerprint !== fingerprint) {
        return NextResponse.json(
          { ok: false, erro: "Este identificador de publicação já foi usado com outro conteúdo." },
          { status: 409 },
        )
      }
      return NextResponse.json({
        ok: true,
        duplicado: true,
        clientRequestId,
        escala: escalaPublica(existente),
      })
    }
  }

  const dadosEscala = {
    data,
    horario,
    celebrante,
    pessoas,
    observacoes,
    celebracao_liturgica: celebracaoLiturgica || null,
    tempo_liturgico: tempoLiturgico || null,
    cor_liturgica: corLiturgica || null,
    ciclo_dominical: cicloDominical || null,
    data_liturgica: dataLiturgica || null,
    ...(clientRequestId ? {
      client_request_id: clientRequestId,
      client_request_fingerprint: fingerprint,
      criado_por: sessao.sub,
    } : {}),
  }
  const escala = salvarEscala(dadosEscala as Parameters<typeof salvarEscala>[0]) as EscalaIdempotente

  const equipe = listarMembrosAprovados()
  const escalados = new Set(pessoas.map((p) => p.id).filter((id): id is string => Boolean(id)))
  const naoEscalados = equipe.filter((m) => !escalados.has(m.id)).map((m) => m.id)
  if (naoEscalados.length) {
    notificarUsuarios(naoEscalados, {
      chave: `escala-publicada:${escala.id}`,
      tipo: "escala",
      titulo: "Nova escala publicada",
      mensagem: `Nova escala para ${data.split("-").reverse().join("/")} às ${horario}. Confira a equipe e as funções.`,
      href: "/escala",
    })
  }
  for (const pessoa of pessoas) {
    if (!pessoa.id) continue
    notificarUsuarios([pessoa.id], {
      chave: `escala-publicada:${escala.id}`,
      tipo: "escala",
      titulo: "Você está na nova escala",
      mensagem: `${data.split("-").reverse().join("/")} às ${horario} · sua função: ${pessoa.funcao}.`,
      href: "/escala",
    })
  }

  return NextResponse.json({ ok: true, clientRequestId: clientRequestId || null, escala: escalaPublica(escala) })
}
