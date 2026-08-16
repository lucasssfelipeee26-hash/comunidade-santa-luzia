import { NextResponse } from "next/server"
import { APP_AUTH_RELEASE, APP_DISPLAY_VERSION } from "@/lib/app-release"
import { obterRevisaoDados } from "@/lib/db"
import { obterRevisaoTemaSite } from "@/lib/site-theme"
import { obterReleaseAndroid } from "@/lib/android-release"
import novidades from "@/config/app-changelog.json"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      appRelease: APP_AUTH_RELEASE,
      displayVersion: APP_DISPLAY_VERSION,
      android: obterReleaseAndroid(),
      novidades,
      revisaoDados: obterRevisaoDados(),
      revisaoTema: obterRevisaoTemaSite(),
      servidorEm: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
