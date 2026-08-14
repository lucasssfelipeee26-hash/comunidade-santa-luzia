"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"

export function NativePlatformRuntime() {
  useEffect(() => {
    const android = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    if (android) document.documentElement.dataset.nativePlatform = "android"
  }, [])

  return null
}
