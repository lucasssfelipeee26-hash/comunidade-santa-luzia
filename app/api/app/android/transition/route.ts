import { NextResponse } from "next/server"
import transition from "@/config/android-transition-code18.json"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      available: true,
      transition: true,
      ...transition,
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
