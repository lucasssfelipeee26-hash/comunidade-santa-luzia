"use client"

import { SWRConfig } from "swr"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { NativeNotificationRuntime } from "@/components/native-notification-runtime"
import { ServerSyncRuntime } from "@/components/server-sync-runtime"
import { AndroidUpdateRuntime } from "@/components/android-update-runtime"
import { NativePlatformRuntime } from "@/components/native-platform-runtime"
import { GameRankingRefreshRuntime } from "@/components/game-ranking-refresh-runtime"
import { AndroidOfflineSnapshotRuntime } from "@/components/android-offline-snapshot-runtime"
import { MobilePolishRuntime } from "@/components/mobile-polish-runtime"
import { AppChangelogRuntime } from "@/components/app-changelog-runtime"

export function AppRuntime({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 30_000, focusThrottleInterval: 60_000, revalidateOnFocus: false, revalidateOnReconnect: true, keepPreviousData: true, errorRetryCount: 1, errorRetryInterval: 2_500, loadingTimeout: 8_000 }}>
      {children}
      <MobilePolishRuntime />
      <NativePlatformRuntime />
      <NativeNotificationRuntime />
      <GameRankingRefreshRuntime />
      <AndroidOfflineSnapshotRuntime />
      <AppChangelogRuntime />
      <AndroidUpdateRuntime />
      <ServerSyncRuntime />
      <PullToRefresh />
    </SWRConfig>
  )
}
