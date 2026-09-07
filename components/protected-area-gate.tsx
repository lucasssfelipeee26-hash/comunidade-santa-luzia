"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthSession } from "@/components/auth-session-runtime"
import { LateArrivalBanner } from "@/components/late-arrival-banner"
import { StoreProvider } from "@/lib/store"

const PUBLIC_AUTH_PATHS = [
  "/area-restrita/login",
  "/area-restrita/cadastro",
  "/area-restrita/recuperar-senha",
]

function isPublicAuthPath(pathname: string) {
  return PUBLIC_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function StableAuthShell() {
  return (
    <div className="area-restrita-shell min-h-screen bg-background text-foreground" aria-busy="true" data-auth-gate-waiting="true">
      <main className="mx-auto flex min-h-[72vh] w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="h-16 w-full max-w-sm rounded-2xl border border-border bg-white/80" />
      </main>
    </div>
  )
}

function PublicArea({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <div className="area-restrita-shell min-h-screen bg-background text-foreground">{children}</div>
    </StoreProvider>
  )
}

function ProtectedArea({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <div className="area-restrita-shell min-h-screen bg-background text-foreground" data-auth-gate-ready="true">
        <LateArrivalBanner />
        {children}
      </div>
    </StoreProvider>
  )
}

export function ProtectedAreaGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { ready, liveAuthenticated } = useAuthSession()
  const publicAuth = isPublicAuthPath(pathname)

  useEffect(() => {
    if (publicAuth || !ready || liveAuthenticated) return
    const destino = `${window.location.pathname}${window.location.search}`
    const query = destino && destino !== "/area-restrita" ? `?destino=${encodeURIComponent(destino)}` : ""
    router.replace(`/area-restrita/login${query}`)
  }, [liveAuthenticated, pathname, publicAuth, ready, router])

  if (publicAuth) return <PublicArea>{children}</PublicArea>
  if (!ready || !liveAuthenticated) return <StableAuthShell />
  return <ProtectedArea>{children}</ProtectedArea>
}
