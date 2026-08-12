"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function NativeNotificationRuntime() {
  const router = useRouter()

  useEffect(() => {
    let cancelado = false
    let removerListener: (() => Promise<void>) | undefined

    async function iniciar() {
      try {
        const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/local-notifications"),
        ])

        if (!Capacitor.isNativePlatform() || cancelado) return

        const handle = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          ({ notification }) => {
            const rota = notification.extra?.rota
            if (typeof rota === "string" && rota.startsWith("/")) {
              router.push(rota)
              router.refresh()
            }
          },
        )

        if (cancelado) {
          await handle.remove()
          return
        }
        removerListener = () => handle.remove()
      } catch (error) {
        console.warn("[Santa Luzia] Notificações nativas indisponíveis neste ambiente.", error)
      }
    }

    void iniciar()

    return () => {
      cancelado = true
      if (removerListener) void removerListener()
    }
  }, [router])

  return null
}
