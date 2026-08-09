"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { site } from "@/lib/site"

export function AreaHeader({
  titulo,
  subtitulo,
  badge,
  voltarHref,
  voltarLabel = "Voltar ao site",
  menu,
}: {
  titulo: string
  subtitulo?: string
  badge?: React.ReactNode
  voltarHref?: string
  voltarLabel?: string
  menu?: React.ReactNode
}) {
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.replace("/area-restrita/login")
      router.refresh()
    }
  }

  return (
    <header className="border-b-2 border-accent bg-card/95 text-foreground shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <div className="min-w-0">
          {voltarHref && (
            <Link
              href={voltarHref}
              className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition hover:text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {voltarLabel}
            </Link>
          )}
          <h1 className="text-pretty font-serif text-2xl font-semibold tracking-tight text-primary">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{subtitulo ?? site.comunidade}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {menu}
          {badge}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-white/80 px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/45 hover:bg-primary/5"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export { Badge }
