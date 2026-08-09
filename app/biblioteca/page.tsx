import { BibliotecaCatolica } from "@/components/biblioteca-catolica"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function BibliotecaPage() {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10">
        <BibliotecaCatolica />
      </main>
      <SiteFooter />
    </div>
  )
}
