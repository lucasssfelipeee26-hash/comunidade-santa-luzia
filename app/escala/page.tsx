import { EscalaPublica } from "@/components/escala-publica"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export const dynamic = "force-dynamic"

export default function EscalaPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm uppercase tracking-[.2em] text-accent-foreground/70">Serviço do altar</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-primary">Escala do Dia</h1>
        <p className="mb-8 mt-3 text-muted-foreground">
          Consulte as escalas publicadas com o sacerdote celebrante, acólitos, coroinhas e suas funções.
        </p>
        <EscalaPublica />
      </main>
      <SiteFooter />
    </div>
  )
}
