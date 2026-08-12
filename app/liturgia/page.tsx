import { CentralLiturgicaILiturgia } from "@/components/central-liturgica-iliturgia"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function LiturgiaPage() {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8 lg:px-6">
        <CentralLiturgicaILiturgia />
      </main>
      <SiteFooter />
    </div>
  )
}
