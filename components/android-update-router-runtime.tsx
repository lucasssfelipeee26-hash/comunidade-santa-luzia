"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { AndroidUpdateGithubRuntime } from "@/components/android-update-github-runtime"
import { Motion2UpdateBanner } from "@/components/motion-2-update-banner"

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

export function AndroidUpdateRouterRuntime() {
  const [build, setBuild] = useState<number | null>(null)

  useEffect(() => {
    if (!androidNativo()) {
      setBuild(-1)
      return
    }
    let cancelado = false
    void import("@capacitor/app").then(async ({ App }) => {
      const info = await App.getInfo()
      const numero = Number.parseInt(info.build, 10)
      if (!cancelado) setBuild(Number.isFinite(numero) ? numero : -1)
    }).catch(() => { if (!cancelado) setBuild(-1) })
    return () => { cancelado = true }
  }, [])

  if (build === null || build < 0) return null

  // A build 18 é a ponte: depois de instalada, ela mostra exclusivamente
  // a apresentação premium do Motion 2.0 quando o code 19 estiver publicado.
  if (build === 18) return <Motion2UpdateBanner />

  // Builds anteriores continuam vendo apenas a atualização técnica code 18;
  // builds Motion (19+) voltam ao atualizador padrão para as versões futuras.
  return <AndroidUpdateGithubRuntime />
}
