import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

const PERMITIDOS = new Set([
  "catequeses.html.json.gz","comentarios.html.json.gz","evangelhos.html.json.gz","gerais.html.json.gz",
  "lecionario.html.json.gz","missal.html.json.gz","rosario.html.json.gz","salterio.html.json.gz",
  ...Array.from({ length: 10 }, (_, i) => `oficio-${String(i + 1).padStart(2, "0")}.html.json.gz`),
])

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const nome = req.nextUrl.searchParams.get("nome") || ""
  if (!PERMITIDOS.has(nome)) return NextResponse.json({ error: "Documento não permitido" }, { status: 404 })
  try {
    const data = await readFile(path.join(process.cwd(), nome))
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/gzip",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return NextResponse.json({ error: "Pacote litúrgico não encontrado" }, { status: 404 })
  }
}
