"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { SWRConfig } from "swr"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { NativeNotificationRuntime } from "@/components/native-notification-runtime"
import { ServerSyncRuntime } from "@/components/server-sync-runtime"
import { AndroidUpdateGithubRuntime } from "@/components/android-update-github-runtime"
import { AndroidUpdateTransitionGuard } from "@/components/android-update-transition-guard"
import { NativePlatformRuntime } from "@/components/native-platform-runtime"
import { GameRankingRefreshRuntime } from "@/components/game-ranking-refresh-runtime"
import { AndroidOfflineSnapshotRuntime } from "@/components/android-offline-snapshot-runtime"
import { MobilePolishRuntime } from "@/components/mobile-polish-runtime"
import { AppChangelogRuntime } from "@/components/app-changelog-runtime"
import { AuthSessionProvider, useAuthSession } from "@/components/auth-session-runtime"

const AUTH_SCREEN_PATHS = ["/area-restrita/login", "/area-restrita/cadastro", "/area-restrita/recuperar-senha"]

function NavigationAbortGuard() {
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | null | undefined
      const name = String(reason?.name || "")
      const message = String(reason?.message || "")
      if (name === "AbortError" || /(?:user )?aborted a request|request (?:was )?aborted/i.test(message)) {
        event.preventDefault()
      }
    }
    window.addEventListener("unhandledrejection", onUnhandled)
    return () => window.removeEventListener("unhandledrejection", onUnhandled)
  }, [])
  return null
}

function RuntimeContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { ready, liveAuthenticated } = useAuthSession()
  const authScreen = AUTH_SCREEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const protectedRuntimeReady = Boolean(ready && liveAuthenticated && !authScreen)

  return (
    <>
      {children}
      <NavigationAbortGuard />
      <MobilePolishRuntime />
      <NativePlatformRuntime />
      <GameRankingRefreshRuntime />
      {protectedRuntimeReady ? <NativeNotificationRuntime /> : null}
      {protectedRuntimeReady ? <AndroidOfflineSnapshotRuntime /> : null}
      <AppChangelogRuntime />
      <AndroidUpdateTransitionGuard />
      <AndroidUpdateGithubRuntime />
      {ready ? <ServerSyncRuntime authenticated={protectedRuntimeReady} /> : null}
      <PullToRefresh />
    </>
  )
}

export function AppRuntime({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 60_000, focusThrottleInterval: 60_000, revalidateOnFocus: false, revalidateOnReconnect: true, keepPreviousData: true, errorRetryCount: 1, errorRetryInterval: 2_500, loadingTimeout: 8_000 }}>
      <AuthSessionProvider>
        <RuntimeContent>{children}</RuntimeContent>
      </AuthSessionProvider>
    </SWRConfig>
  )
}
