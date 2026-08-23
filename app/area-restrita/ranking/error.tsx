"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RankingError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-xl place-items-center px-5 py-12">
      <section className="w-full rounded-3xl border bg-white p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-primary">O Quiz não terminou de carregar</h1>
        <p className="mt-2 text-sm text-muted-foreground">A tela foi protegida contra o erro. Tente abrir novamente.</p>
        <Button type="button" className="mt-4 gap-2" onClick={retry}><RefreshCw className="size-4" /> Abrir o Quiz novamente</Button>
      </section>
    </main>
  )
}
