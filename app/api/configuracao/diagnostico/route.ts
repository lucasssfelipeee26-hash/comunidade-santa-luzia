import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  }

  const glitchTipDsn = String(process.env.GLITCHTIP_DSN || process.env.NEXT_PUBLIC_GLITCHTIP_DSN || "").trim()
  return NextResponse.json({
    ok: true,
    glitchTipDsn: glitchTipDsn || null,
    deepScan: true,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } })
}
