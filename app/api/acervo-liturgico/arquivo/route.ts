import fs from "node:fs"
import { NextRequest, NextResponse } from "next/server"
import { caminhoArquivoAcervo } from "@/lib/acervo-liturgico-storage"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const nome = req.nextUrl.searchParams.get("nome") || ""
  const arquivo = caminhoArquivoAcervo(nome)
  if (!arquivo || !fs.existsSync(arquivo)) {
    return NextResponse.json({ erro: "Arquivo do acervo não encontrado." }, { status: 404 })
  }

  const bytes = fs.readFileSync(arquivo)
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": nome.endsWith(".json.gz") ? "application/gzip" : "application/json; charset=utf-8",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
