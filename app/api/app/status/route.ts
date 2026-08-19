import { NextResponse } from "next/server"
import { APP_AUTH_RELEASE, APP_DISPLAY_VERSION } from "@/lib/app-release"
import { obterRevisaoDados } from "@/lib/db"
import { obterRevisaoTemaSite } from "@/lib/site-theme"
import { obterReleaseAndroid } from "@/lib/android-release"
import novidades from "@/config/app-changelog.json"

export const dynamic = "force-dynamic"

// A revisão do tema já é observada pelas builds Android anteriores e provoca
// uma única recarga segura quando muda. O sufixo abaixo força quem está com o
// bundle antigo em memória a buscar o runtime corrigido do banner de atualização.
const REVISAO_INTERFACE = "ui-20260818-update-banner-v2"

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      appRelease: APP_AUTH_RELEASE,
      displayVersion: APP_DISPLAY_VERSION,
      android: obterReleaseAndroid(),
      novidades,
      revisaoDados: obterRevisaoDados(),
      revisaoTema: `${obterRevisaoTemaSite()}:${REVISAO_INTERFACE}`,
      servidorEm: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    },
  )
}
