import { NextResponse } from "next/server"
import { obterUrlApkAndroid } from "@/lib/android-release"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.redirect(obterUrlApkAndroid(), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  })
}
