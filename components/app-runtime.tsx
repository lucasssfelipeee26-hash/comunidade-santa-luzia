"use client"

import { SWRConfig } from "swr"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { NativeNotificationRuntime } from "@/components/native-notification-runtime"
import { ServerSyncRuntime } from "@/components/server-sync-runtime"

export function AppRuntime({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 30_000, focusThrottleInterval: 60_000, revalidateOnFocus: false, revalidateOnReconnect: true, keepPreviousData: true, errorRetryCount: 1, errorRetryInterval: 2_500, loadingTimeout: 8_000 }}>
      {children}
      <NativeNotificationRuntime />
      <ServerSyncRuntime />
      <PullToRefresh />
    </SWRConfig>
  )
}
