import { NextResponse } from "next/server"
import { obterReleaseAndroid } from "@/lib/android-release"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const release = obterReleaseAndroid()
  const versaoArquivo = release.versionName.replace(/[^0-9A-Za-z._-]/g, "-")
  const destino = new URL(`/downloads/Santa-Luzia-${versaoArquivo}.apk?version=${release.versionCode}`, request.url)
  return NextResponse.redirect(destino, {
    status: 307,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
