"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"

const MANIFESTO_GITHUB = "https://raw.githubusercontent.com/lucasssfelipeee26-hash/comunidade-santa-luzia/main/config/android-release.json"
const MANIFESTO_TRANSICAO = "/api/app/android/transition"
const DOWNLOAD_TRANSICAO = "https://comunidade-santa-luzia-production.up.railway.app/api/app/android/download-transition"

function androidNativo() {
  if (typeof window === "undefined") return false
  try {
    return Capacitor.getPlatform() === "android"
      || document.documentElement.dataset.nativePlatform === "android"
      || navigator.userAgent.includes("SantaLuziaAndroid")
  } catch {
    return navigator.userAgent.includes("SantaLuziaAndroid")
  }
}

export function AndroidUpdateTransitionGuard() {
  useEffect(() => {
    if (!androidNativo()) return

    const fetchOriginal = window.fetch.bind(window)
    const buildPromise = import("@capacitor/app")
      .then(async ({ App }) => {
        const info = await App.getInfo()
        const build = Number.parseInt(info.build, 10)
        return Number.isFinite(build) ? build : -1
      })
      .catch(() => -1)

    const obterUrl = (input: RequestInfo | URL) => {
      if (typeof input === "string") return input
      if (input instanceof URL) return input.toString()
      return input.url
    }

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = obterUrl(input)
      if (url.startsWith(MANIFESTO_GITHUB)) {
        const build = await buildPromise
        if (build > 0 && build < 18) {
          const separador = MANIFESTO_TRANSICAO.includes("?") ? "&" : "?"
          return fetchOriginal(`${MANIFESTO_TRANSICAO}${separador}update=${Date.now()}`, {
            ...init,
            cache: "no-store",
            headers: { ...(init?.headers || {}), Accept: "application/json" },
          })
        }
      }
      return fetchOriginal(input, init)
    }) as typeof window.fetch

    let restaurarPlugin: (() => void) | null = null
    void import("@/lib/native-app-updater").then(({ AppUpdater }) => {
      const original = AppUpdater.downloadAndInstall.bind(AppUpdater)
      AppUpdater.downloadAndInstall = async (opcoes) => {
        const build = await buildPromise
        if (build > 0 && build < 18) {
          return original({ ...opcoes, url: DOWNLOAD_TRANSICAO })
        }
        return original(opcoes)
      }
      restaurarPlugin = () => { AppUpdater.downloadAndInstall = original }
    }).catch(() => {})

    return () => {
      window.fetch = fetchOriginal
      restaurarPlugin?.()
    }
  }, [])

  return null
}
