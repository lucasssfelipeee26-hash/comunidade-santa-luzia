import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { lerTemaSite, salvarTemaSite } from "@/lib/site-theme"
import { temaValido, temasSantaLuzia } from "@/lib/site-theme-shared"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    { ok: true, tema: lerTemaSite(), opcoes: temasSantaLuzia },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}

export async function POST(req: Request) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json(
      { ok: false, erro: "Apenas moderadores podem alterar as cores do site." },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null) as { tema?: unknown } | null
  if (!temaValido(body?.tema)) {
    return NextResponse.json({ ok: false, erro: "Tema inválido." }, { status: 400 })
  }

  salvarTemaSite(body.tema)
  return NextResponse.json({ ok: true, tema: body.tema })
}
