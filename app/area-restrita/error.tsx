"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"

export default function AreaRestritaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-7 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-primary">Falha na Área Restrita</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">A página não conseguiu atualizar corretamente. Tente novamente.</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">
          <RefreshCw className="size-4" /> Recarregar
        </button>
      </section>
    </main>
  )
}
