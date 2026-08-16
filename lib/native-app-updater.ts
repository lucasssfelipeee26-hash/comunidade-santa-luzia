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
const REPOSITORIO = "lucasssfelipeee26-hash/comunidade-santa-luzia"

function ehFalhaIntegridadeLegada(falha: unknown) {
  if (!falha || typeof falha !== "object") return false
  const dados = falha as { code?: unknown; message?: unknown }
  const codigo = String(dados.code || "").toUpperCase()
  const mensagem = String(dados.message || "").toLowerCase()
  return codigo === "ATUALIZACAO_INVALIDA" || mensagem.includes("dados de integridade")
}

function obterUrlDiretaRelease(nomeArquivo: string) {
  const correspondencia = /^Santa-Luzia-([0-9A-Za-z._-]+)\.apk$/i.exec(nomeArquivo)
  if (!correspondencia) return `https://github.com/${REPOSITORIO}/releases/latest/download/santa-luzia.apk`

  const versao = correspondencia[1]
  return `https://github.com/${REPOSITORIO}/releases/download/android-v${encodeURIComponent(versao)}/${encodeURIComponent(nomeArquivo)}`
}

async function abrirDownloadSeguro(nomeArquivo: string): Promise<DownloadAndInstallResult> {
  const { Browser } = await import("@capacitor/browser")
  await Browser.open({ url: obterUrlDiretaRelease(nomeArquivo), presentationStyle: "popover" })
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
      return abrirDownloadSeguro(options.fileName)
    }
  },
}
