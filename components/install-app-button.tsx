import Link from "next/link"
import { Download } from "lucide-react"

export function InstallAppButton() {
  return (
    <Link
      href="/baixar"
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c99a2e] bg-[#f6e7b7] px-4 py-3 text-sm font-bold text-[#681225] transition hover:bg-[#ecd58c]"
    >
      <Download className="size-4" aria-hidden="true" />
      Baixar aplicativo Android
    </Link>
  )
}
