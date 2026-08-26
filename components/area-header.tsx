"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { NotificationCenter } from "@/components/notification-center"
import { ProfileDoorIcon } from "@/components/profile-door-icon"
import { DoorTransitionScene } from "@/components/door-transition-scene"
import { site } from "@/lib/site"

function doorTransitionDelay() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 420
  } catch {}
  return 2220
}

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
  const [leaving, setLeaving] = useState(false)

  async function handleLogout() {
    if (leaving) return
    setLeaving(true)

    const logoutRequest = fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    // Ao sair, a cena mostra o personagem vindo de dentro da porta para fora,
    // de frente, caminhando normalmente. A navegação só ocorre ao final.
    await new Promise<void>((resolve) => window.setTimeout(resolve, doorTransitionDelay()))
    await Promise.race([logoutRequest, new Promise<void>((resolve) => window.setTimeout(resolve, 1200))])

    router.replace("/area-restrita/login")
    router.refresh()
  }

  return (
    <>
      <DoorTransitionScene direction="exit" active={leaving} />
      <header className="app-safe-header sticky top-0 z-50 w-full border-b border-accent/75 bg-white text-foreground shadow-sm" data-no-pull-refresh>
        <div className="app-header-row mx-auto flex w-full max-w-6xl items-center gap-2 px-[var(--app-gutter)] sm:min-h-[78px] sm:py-3">
          {voltarHref && (
            <Link href={voltarHref} title={voltarLabel} aria-label={voltarLabel} className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-primary active:scale-95 sm:size-10">
              <ArrowLeft className="size-[18px]" aria-hidden="true" />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate font-serif text-[1.16rem] font-semibold leading-tight tracking-tight text-primary sm:text-2xl">{titulo}</h1>
              {badge && <div className="hidden shrink-0 sm:block">{badge}</div>}
            </div>
            <p className="truncate text-[10px] leading-4 text-muted-foreground sm:text-sm">{subtitulo ?? site.comunidade}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationCenter />
            {menu}
            <button type="button" onClick={handleLogout} disabled={leaving} aria-busy={leaving} className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-white text-primary shadow-sm transition active:scale-95 disabled:cursor-wait disabled:opacity-90 sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm sm:font-medium" aria-label={leaving ? "Saindo da Área Restrita" : "Sair da Área Restrita"} title="Sair" data-sl-nav-motion="logout-door" data-logout-door-transition={leaving ? "running" : "idle"}>
              <ProfileDoorIcon className="size-[19px]" animated={false} loop={false} direction="exit" />
              <span className="hidden sm:inline">{leaving ? "Saindo…" : "Sair"}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

export { Badge }
