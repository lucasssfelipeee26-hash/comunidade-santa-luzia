import { NextResponse } from "next/server"
import { obterReleaseAndroid, obterUrlApkAndroid } from "@/lib/android-release"

export const dynamic = "force-dynamic"

export async function GET() {
  const release = obterReleaseAndroid()
  const versaoArquivo = release.versionName.replace(/[^0-9A-Za-z._-]/g, "-")

  try {
    const upstream = await fetch(obterUrlApkAndroid(), {
      cache: "no-store",
      redirect: "follow",
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "APK Android temporariamente indisponível." }, { status: 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", "application/vnd.android.package-archive")
    headers.set("Content-Disposition", `attachment; filename="Santa-Luzia-${versaoArquivo}.apk"`)
    headers.set("Cache-Control", "no-store, max-age=0")
    const tamanho = upstream.headers.get("content-length")
    if (tamanho) headers.set("Content-Length", tamanho)

    return new Response(upstream.body, { status: 200, headers })
  } catch {
    return NextResponse.json({ error: "Falha ao obter a atualização Android." }, { status: 502 })
  }
}
