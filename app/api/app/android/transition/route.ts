import { NextResponse } from "next/server"
import release from "@/config/android-release.json"

export const dynamic = "force-dynamic"

const MIN_CONSOLIDATED_VERSION_CODE = 20

export async function GET() {
  if (release.versionCode < MIN_CONSOLIDATED_VERSION_CODE) {
    return NextResponse.json(
      {
        available: false,
        transition: true,
        message: "A atualização consolidada ainda está sendo preparada.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  }

  return NextResponse.json(
    {
      available: true,
      transition: true,
      ...release,
      required: true,
      downloadUrl: "/api/app/android/download-transition",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}
