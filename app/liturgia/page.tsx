import Link from "next/link"
import { Library } from "lucide-react"
import { CentroLiturgico } from "@/components/centro-liturgico"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function LiturgiaPage() {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8 lg:px-6">
        <div className="mb-4 flex justify-end">
          <Link href="/liturgia/acervo" className="inline-flex items-center gap-2 rounded-xl bg-[#0b4b35] px-4 py-2.5 text-sm font-bold text-white shadow-sm">
            <Library className="size-4" /> Abrir Acervo Litúrgico Offline
          </Link>
        </div>
        <CentroLiturgico />
      </main>
      <SiteFooter />
    </div>
  )
}
