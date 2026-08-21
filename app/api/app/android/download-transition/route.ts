import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import release from "@/config/android-release.json"

const APK_CONSOLIDADO = "https://github.com/lucasssfelipeee26-hash/comunidade-santa-luzia/releases/latest/download/santa-luzia.apk"
const MIN_CONSOLIDATED_VERSION_CODE = 20

export const dynamic = "force-dynamic"

export async function GET() {
  if (release.versionCode < MIN_CONSOLIDATED_VERSION_CODE) {
    return NextResponse.json({ error: "A atualização consolidada ainda não foi publicada." }, { status: 503 })
  }

  try {
    const upstream = await fetch(APK_CONSOLIDADO, { cache: "no-store", redirect: "follow" })
    if (!upstream.ok) {
      return NextResponse.json({ error: "APK consolidado temporariamente indisponível." }, { status: 502 })
    }

    const apk = await upstream.arrayBuffer()
    const tamanhoRecebido = apk.byteLength
    const shaRecebido = createHash("sha256").update(Buffer.from(apk)).digest("hex")

    if (tamanhoRecebido !== release.apkSize || shaRecebido !== release.apkSha256.toLowerCase()) {
      return NextResponse.json({ error: "O APK consolidado não passou na validação de integridade." }, { status: 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", "application/vnd.android.package-archive")
    headers.set("Content-Disposition", `attachment; filename="Santa-Luzia-${release.versionName}-code${release.versionCode}.apk"`)
    headers.set("Content-Length", String(tamanhoRecebido))
    headers.set("X-APK-SHA256", shaRecebido)
    headers.set("Cache-Control", "private, no-store, max-age=0")
    headers.set("X-Content-Type-Options", "nosniff")

    return new Response(apk, { status: 200, headers })
  } catch {
    return NextResponse.json({ error: "Falha ao obter a atualização consolidada Android." }, { status: 502 })
  }
}
