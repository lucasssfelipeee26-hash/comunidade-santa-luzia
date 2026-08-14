import { NextResponse } from "next/server"
import { obterReleaseAndroid, obterUrlApkAndroid } from "@/lib/android-release"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const release = obterReleaseAndroid()
  const versaoArquivo = release.versionName.replace(/[^0-9A-Za-z._-]/g, "-")

  try {
    const origem = await fetch(obterUrlApkAndroid(), {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "application/vnd.android.package-archive, application/octet-stream",
        "User-Agent": "Santa-Luzia-Android-Update/1.0",
      },
    })

    if (!origem.ok || !origem.body) throw new Error(`APK indisponível: ${origem.status}`)

    const headers = new Headers({
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="Santa-Luzia-${versaoArquivo}.apk"`,
      "Content-Type": "application/vnd.android.package-archive",
      "X-Content-Type-Options": "nosniff",
    })
    const tamanho = origem.headers.get("content-length")
    if (tamanho) headers.set("Content-Length", tamanho)

    return new Response(origem.body, { status: 200, headers })
  } catch {
    return NextResponse.json(
      { ok: false, erro: "Não foi possível iniciar o download. Tente novamente em alguns instantes." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  }
}
