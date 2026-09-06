import { NextResponse } from "next/server"
import { lerManifestoAcervo } from "@/lib/acervo-liturgico-storage"

export const dynamic = "force-dynamic"

export async function GET() {
  const manifesto = lerManifestoAcervo()

  if (!manifesto) {
    // O APK Motion já carrega o iLiturgia pelo pacote interno. A ausência do
    // acervo opcional no volume do servidor não é erro de execução e não deve
    // provocar 404/re-renderizações sucessivas nas rotinas de sincronização.
    return NextResponse.json(
      { ok: true, instalado: false, offline: true, total: 0, categorias: [] },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    { ok: true, instalado: true, ...manifesto },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  )
}
