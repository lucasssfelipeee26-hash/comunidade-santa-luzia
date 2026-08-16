import { createHash } from "node:crypto"
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

    if (!upstream.ok) {
      return NextResponse.json({ error: "APK Android temporariamente indisponível." }, { status: 502 })
    }

    const apk = await upstream.arrayBuffer()
    const tamanhoRecebido = apk.byteLength
    const shaRecebido = createHash("sha256").update(Buffer.from(apk)).digest("hex")

    if (tamanhoRecebido !== release.apkSize || shaRecebido !== release.apkSha256.toLowerCase()) {
      return NextResponse.json({ error: "O APK publicado não passou na validação de integridade." }, { status: 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", "application/vnd.android.package-archive")
    headers.set("Content-Disposition", `attachment; filename="Santa-Luzia-${versaoArquivo}.apk"`)
    headers.set("Content-Length", String(tamanhoRecebido))
    headers.set("X-APK-SHA256", shaRecebido)
    headers.set("Cache-Control", "private, no-store, max-age=0")
    headers.set("X-Content-Type-Options", "nosniff")

    return new Response(apk, { status: 200, headers })
  } catch {
    return NextResponse.json({ error: "Falha ao obter a atualização Android." }, { status: 502 })
  }
}
