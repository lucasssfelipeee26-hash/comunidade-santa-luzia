"use client"

import { AndroidUpdateGithubRuntime } from "@/components/android-update-github-runtime"

/**
 * Um único atualizador para todas as builds.
 * Builds antigas são desviadas pela AndroidUpdateTransitionGuard para a ponte
 * oficial do Railway; builds compatíveis consultam e baixam pelo GitHub.
 */
export function AndroidUpdateRouterRuntime() {
  return <AndroidUpdateGithubRuntime />
}
