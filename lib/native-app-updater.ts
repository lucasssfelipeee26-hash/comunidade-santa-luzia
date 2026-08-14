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

export const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater")
