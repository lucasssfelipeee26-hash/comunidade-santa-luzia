import Link from "next/link"
import { ArrowLeft, Church } from "lucide-react"
import { site } from "@/lib/site"

export function AuthShell({
  icon,
  titulo,
  subtitulo,
  voltarHref,
  voltarLabel = "Voltar ao site",
  rodape,
  children,
}: {
  icon: React.ReactNode
  titulo: string
  subtitulo?: string
  voltarHref?: string
  voltarLabel?: string
  rodape?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 text-foreground sm:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#7b1326_0%,#b7354b_48%,#d4af37_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-20 size-80 rounded-full bg-primary/5 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 size-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {voltarHref && (
          <Link
            href={voltarHref}
            className="mb-5 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {voltarLabel}
          </Link>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_55px_rgba(79,24,35,.10)]">
          <div className="border-b border-border bg-[linear-gradient(180deg,#fff_0%,#fff9f2_100%)] px-8 pb-6 pt-8 text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-accent/55 bg-accent/10 text-primary shadow-sm">
              {icon}
            </span>
            <p className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-accent-foreground/80">
              <Church className="size-3.5" aria-hidden="true" /> {site.comunidade}
            </p>
            <h1 className="text-pretty font-serif text-3xl font-semibold tracking-tight text-primary">{titulo}</h1>
            {subtitulo && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{subtitulo}</p>}
          </div>

          <div className="bg-white px-6 py-7 sm:px-8 sm:py-8">{children}</div>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {rodape ?? <>Área restrita da {site.comunidade} — {site.paroquia}</>}
        </p>
      </div>
    </main>
  )
}
