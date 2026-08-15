/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli"

const valorServidor = String(process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim()
let servidor: CapacitorConfig["server"] | undefined

if (valorServidor) {
  const url = new URL(valorServidor)
  if (url.protocol !== "https:") throw new Error("CAPACITOR_SERVER_URL deve usar HTTPS.")
  servidor = {
    url: url.origin,
    errorPath: "offline.html",
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
  loggingBehavior: "none",
  zoomEnabled: false,
  android: {
    appendUserAgent: " SantaLuziaAndroid",
    backgroundColor: "#fffaf0",
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    loggingBehavior: "none",
  },
  ...(servidor ? { server: servidor } : {}),
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_santa_luzia",
      iconColor: "#7b1326",
      sound: "santa_luzia_notification.wav",
    },
  },
}

export default config
