import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import transition from "@/config/android-transition-code18.json"

const APK_TRANSICAO = "https://github.com/lucasssfelipeee26-hash/comunidade-santa-luzia/releases/download/android-v1.0.6/santa-luzia.apk"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const upstream = await fetch(APK_TRANSICAO, { cache: "no-store", redirect: "follow" })
    if (!upstream.ok) {
      return NextResponse.json({ error: "APK de transição temporariamente indisponível." }, { status: 502 })
    }

    const apk = await upstream.arrayBuffer()
    const tamanhoRecebido = apk.byteLength
    const shaRecebido = createHash("sha256").update(Buffer.from(apk)).digest("hex")

    if (tamanhoRecebido !== transition.apkSize || shaRecebido !== transition.apkSha256.toLowerCase()) {
      return NextResponse.json({ error: "O APK de transição não passou na validação de integridade." }, { status: 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", "application/vnd.android.package-archive")
    headers.set("Content-Disposition", `attachment; filename="Santa-Luzia-${transition.versionName}-code${transition.versionCode}.apk"`)
    headers.set("Content-Length", String(tamanhoRecebido))
    headers.set("X-APK-SHA256", shaRecebido)
    headers.set("Cache-Control", "private, no-store, max-age=0")
    headers.set("X-Content-Type-Options", "nosniff")

    return new Response(apk, { status: 200, headers })
  } catch {
    return NextResponse.json({ error: "Falha ao obter a atualização de transição Android." }, { status: 502 })
  }
}
