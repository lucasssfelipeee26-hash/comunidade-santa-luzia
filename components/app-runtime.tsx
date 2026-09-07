"use client"

import { useEffect } from "react"
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

export function AppRuntime({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 30_000, focusThrottleInterval: 60_000, revalidateOnFocus: false, revalidateOnReconnect: true, keepPreviousData: true, errorRetryCount: 1, errorRetryInterval: 2_500, loadingTimeout: 8_000 }}>
      {children}
      <NavigationAbortGuard />
      <MobilePolishRuntime />
      <NativePlatformRuntime />
      <NativeNotificationRuntime />
      <GameRankingRefreshRuntime />
      <AndroidOfflineSnapshotRuntime />
      <AppChangelogRuntime />
      <AndroidUpdateTransitionGuard />
      <AndroidUpdateGithubRuntime />
      <ServerSyncRuntime />
      <PullToRefresh />
    </SWRConfig>
  )
}
