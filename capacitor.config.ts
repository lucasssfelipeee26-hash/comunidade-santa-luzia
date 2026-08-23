/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli"

const motionBeta = process.env.SANTA_LUZIA_MOTION_BETA === "1"
const motionVersion = String(process.env.SANTA_LUZIA_MOTION_VERSION || "2.0.0-beta.7").trim()
const valorServidor = String(process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim()
let servidor: CapacitorConfig["server"] | undefined

// A Motion Beta não troca para uma segunda experiência offline.
// A origem HTTPS continua sendo usada para sincronização/bootstrap quando existe rede;
// a Beta 7 injeta no APK a camada que persiste e reutiliza as mesmas rotas/telas localmente.
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
  // O namespace Java permanece igual para reaproveitar os plugins nativos testados.
  // No build Motion Beta, o applicationId final é trocado depois do cap sync para
  // br.com.comunidadesantaluzia.motionbeta, permitindo coexistir com o app oficial.
  appId: "br.com.comunidadesantaluzia.app",
  appName: motionBeta ? "Santa Luzia Motion Beta" : "Santa Luzia",
  webDir: "android-web",
  backgroundColor: "#fffaf0",
  loggingBehavior: "none",
  zoomEnabled: false,
  android: {
    // Mantém a identidade própria da Motion Android e adiciona a identidade da
    // Windows Beta 0.1.0-beta.19. As telas reais do app principal ativam os
    // ajustes de Presenças, Escalas, Formação, Registros e Atrasos por esse UA.
    appendUserAgent: motionBeta
      ? ` SantaLuziaAndroid SantaLuziaMotionBeta/${motionVersion} SantaLuziaWindowsBeta/0.1.0-beta.19`
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
