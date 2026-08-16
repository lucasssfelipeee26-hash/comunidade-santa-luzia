import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { listarEscalas, salvarEscala, buscarUsuario, listarMembrosAprovados, type EscalaPessoa } from "@/lib/db"
import { funcaoEscalaValida } from "@/lib/escala-funcoes"
import { notificarUsuarios } from "@/lib/notificacoes"
import { dataCivilIsoValida, horario24hValido } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    { ok: true, escalas: listarEscalas() },
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

  const body = await req.json().catch(() => null) as {
    data?: string
    horario?: string
    celebrante?: string
    observacoes?: string
    pessoas?: Array<{ id?: string; categoria?: string; funcao?: string }>
  } | null

  const data = String(body?.data ?? "").trim()
  const horario = String(body?.horario ?? "").trim()
  const celebrante = String(body?.celebrante ?? "").trim().replace(/\s+/g, " ")
  const observacoes = String(body?.observacoes ?? "").trim()

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

  const escala = salvarEscala({
    data,
    horario,
    celebrante,
    pessoas,
    observacoes,
  })

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

  return NextResponse.json({ ok: true, escala })
}
