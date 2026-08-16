import { registerPlugin, type PluginListenerHandle } from "@capacitor/core"

export type AppUpdateProgress = {
  stage: "downloading" | "verifying" | "permission" | "installing"
  downloaded: number
  total: number
  percent: number
}

type DownloadAndInstallOptions = {
  url: string
  fileName: string
  expectedSha256: string
  expectedSize: number
}

type DownloadAndInstallResult = {
  status: "installer_opened"
}

interface AppUpdaterPlugin {
  downloadAndInstall(options: DownloadAndInstallOptions): Promise<DownloadAndInstallResult>
  addListener(
    eventName: "downloadProgress",
    listener: (event: AppUpdateProgress) => void,
  ): Promise<PluginListenerHandle>
}

const NativeAppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater")

function ehFalhaIntegridadeLegada(falha: unknown) {
  if (!falha || typeof falha !== "object") return false
  const dados = falha as { code?: unknown; message?: unknown }
  const codigo = String(dados.code || "").toUpperCase()
  const mensagem = String(dados.message || "").toLowerCase()
  return codigo === "ATUALIZACAO_INVALIDA" || mensagem.includes("dados de integridade")
}

async function abrirDownloadSeguro(url: string): Promise<DownloadAndInstallResult> {
  const { Browser } = await import("@capacitor/browser")
  await Browser.open({ url, presentationStyle: "popover" })
  return { status: "installer_opened" }
}

export const AppUpdater: AppUpdaterPlugin = {
  addListener(eventName, listener) {
    return NativeAppUpdater.addListener(eventName, listener)
  },

  async downloadAndInstall(options) {
    try {
      return await NativeAppUpdater.downloadAndInstall(options)
    } catch (falha) {
      if (!ehFalhaIntegridadeLegada(falha)) throw falha
      return abrirDownloadSeguro(options.url)
    }
  },
}
