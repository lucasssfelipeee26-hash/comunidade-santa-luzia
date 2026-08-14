import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { listarEscalas, salvarEscala, buscarUsuario, type EscalaPessoa } from "@/lib/db"
import { funcaoEscalaValida } from "@/lib/escala-funcoes"

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
  const celebrante = String(body?.celebrante ?? "").trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ ok: false, erro: "Informe uma data válida para a escala." }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}$/.test(horario)) {
    return NextResponse.json({ ok: false, erro: "Informe um horário válido." }, { status: 400 })
  }
  if (!celebrante) {
    return NextResponse.json({ ok: false, erro: "Informe o sacerdote celebrante." }, { status: 400 })
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
    if (pessoa.categoria !== categoria) continue

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
    observacoes: String(body?.observacoes ?? "").trim(),
  })

  return NextResponse.json({ ok: true, escala })
}
