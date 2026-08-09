"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-primary">Não foi possível carregar esta página</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Ocorreu uma falha temporária. Você pode tentar carregar novamente sem perder os dados já salvos.</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </section>
    </main>
  )
}
