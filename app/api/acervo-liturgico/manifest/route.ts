import { NextResponse } from "next/server"
import { lerManifestoAcervo } from "@/lib/acervo-liturgico-storage"

export const dynamic = "force-dynamic"

export async function GET() {
  const manifesto = lerManifestoAcervo()
  if (!manifesto) {
    return NextResponse.json({ erro: "Acervo litúrgico offline ainda não foi instalado." }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json(manifesto, { headers: { "Cache-Control": "public, max-age=3600" } })
}
