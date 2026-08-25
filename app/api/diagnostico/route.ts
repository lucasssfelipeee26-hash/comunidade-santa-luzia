import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { obterRevisaoDados } from "@/lib/db"
import { lerSaudeBancoSantaLuzia } from "@/lib/data-protection"

export const dynamic = "force-dynamic"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ ok: false, erro: "Acesso exclusivo do moderador." }, { status: 403 })
  }

  const banco = lerSaudeBancoSantaLuzia()
  return NextResponse.json({
    ok: true,
    versaoDiagnostico: 1,
    revisaoDados: obterRevisaoDados(),
    banco: banco ? {
      checkedAt: banco.checkedAt,
      status: banco.status,
      size: banco.size,
      sha256: banco.sha256,
      backupCount: banco.backupCount,
      lastBackup: banco.lastBackup,
      recoveredFrom: banco.recoveredFrom || null,
      error: banco.error || null,
    } : null,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } })
}
