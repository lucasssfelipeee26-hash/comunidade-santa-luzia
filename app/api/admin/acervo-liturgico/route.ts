import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"
import { instalarTarAcervo, statusAcervo } from "@/lib/acervo-liturgico-storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function moderador() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  return usuario?.tipo === "moderador" ? usuario : null
}

export async function GET() {
  if (!await moderador()) return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })
  return NextResponse.json(statusAcervo(), { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  if (!await moderador()) return NextResponse.json({ erro: "Apenas moderadores." }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get("arquivo")
  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Selecione o pacote .tar do acervo litúrgico." }, { status: 400 })
  if (!arquivo.name.toLowerCase().endsWith(".tar")) return NextResponse.json({ erro: "O arquivo deve estar no formato .tar." }, { status: 400 })
  if (arquivo.size > 30 * 1024 * 1024) return NextResponse.json({ erro: "O pacote excede o limite de 30 MB." }, { status: 413 })

  try {
    const resultado = instalarTarAcervo(Buffer.from(await arquivo.arrayBuffer()))
    return NextResponse.json({ ok: true, ...resultado }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Não foi possível instalar o acervo." }, { status: 400 })
  }
}
