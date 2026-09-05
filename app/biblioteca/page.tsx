import { BibliotecaCatolica } from "@/components/biblioteca-catolica"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function BibliotecaPage() {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-4 lg:px-6 lg:py-6" data-biblioteca-beta20="catalogo">
        <BibliotecaCatolica />
      </main>
      <SiteFooter />
    </div>
  )
}
