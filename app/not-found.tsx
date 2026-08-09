import Link from "next/link"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-accent-foreground">Comunidade Santa Luzia</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-primary">Página não encontrada</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">O endereço acessado não existe ou foi alterado.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          <Home className="size-4" /> Voltar ao início
        </Link>
      </section>
    </main>
  )
}
