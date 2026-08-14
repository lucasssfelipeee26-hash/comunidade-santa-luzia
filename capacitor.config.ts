/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli"

const valorServidor = String(process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim()
let servidor: CapacitorConfig["server"] | undefined

if (valorServidor) {
  const url = new URL(valorServidor)
  if (url.protocol !== "https:") throw new Error("CAPACITOR_SERVER_URL deve usar HTTPS.")
  servidor = {
    url: url.origin,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [url.hostname],
  }
}

const config: CapacitorConfig = {
  appId: "br.com.comunidadesantaluzia.app",
  appName: "Santa Luzia",
  webDir: "android-web",
  backgroundColor: "#fffaf0",
  ...(servidor ? { server: servidor } : {}),
  plugins: {
    LocalNotifications: {
      iconColor: "#7b1326",
      sound: "santa_luzia_notification.wav",
    },
  },
}

export default config
