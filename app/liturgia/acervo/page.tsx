import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AcervoLiturgicoOffline } from "@/components/acervo-liturgico-offline"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function AcervoLiturgicoPage() {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8 lg:px-6">
        <Link href="/liturgia" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/35 bg-white px-3 py-2 text-sm font-semibold text-[#7b1326]">
          <ArrowLeft className="size-4" /> Voltar à Central de Liturgia
        </Link>
        <AcervoLiturgicoOffline />
      </main>
      <SiteFooter />
    </div>
  )
}
