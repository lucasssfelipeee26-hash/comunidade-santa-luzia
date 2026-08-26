/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli"

const motionBeta = process.env.SANTA_LUZIA_MOTION_BETA === "1"
const motionVersion = String(process.env.SANTA_LUZIA_MOTION_VERSION || "2.0.0-beta.14").trim()
const valorServidor = String(process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim()
let servidor: CapacitorConfig["server"] | undefined

// O Android oficial mantém seu comportamento atual. A Motion Beta preserva
// a arquitetura local/offline aprovada: a interface React nasce dentro do APK
// e não usa server.url. O Railway participa somente da autenticação e do sync.
if (!motionBeta && valorServidor) {
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
  appName: motionBeta ? "Santa Luzia Motion Beta" : "Santa Luzia",
  webDir: "android-web",
  backgroundColor: "#fffaf0",
  loggingBehavior: "none",
  zoomEnabled: false,
  android: {
    appendUserAgent: motionBeta
      ? ` SantaLuziaAndroid SantaLuziaMotionBeta/${motionVersion} SantaLuziaOriginalUIOffline/2 SantaLuziaWindowsBeta/0.1.0-beta.19`
      : " SantaLuziaAndroid",
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
