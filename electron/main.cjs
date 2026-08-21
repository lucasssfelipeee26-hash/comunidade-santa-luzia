const { app, BrowserWindow, shell } = require("electron")
const path = require("node:path")
const beta = require("../config/windows-beta.json")

const APP_URL = process.env.SANTA_LUZIA_WINDOWS_BETA_URL || beta.serverUrl
const ALLOWED_ORIGIN = new URL(APP_URL).origin

app.setName(beta.appName)
app.setAppUserModelId("br.com.comunidadesantaluzia.beta")

function createWindow() {
  const win = new BrowserWindow({
    title: `${beta.appName} ${beta.versionName}`,
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f7f1eb",
    icon: path.join(__dirname, "../public/icon-512x512.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  })

  const currentUserAgent = win.webContents.getUserAgent()
  win.webContents.setUserAgent(`${currentUserAgent} SantaLuziaWindowsBeta/${beta.versionName}`)

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const destino = new URL(url)
      if (destino.origin === ALLOWED_ORIGIN) {
        void win.loadURL(url)
        return { action: "deny" }
      }
      if (destino.protocol === "https:" || destino.protocol === "http:") void shell.openExternal(url)
    } catch {}
    return { action: "deny" }
  })

  win.webContents.on("will-navigate", (event, url) => {
    try {
      const destino = new URL(url)
      if (destino.origin === ALLOWED_ORIGIN) return
      event.preventDefault()
      if (destino.protocol === "https:" || destino.protocol === "http:") void shell.openExternal(url)
    } catch {
      event.preventDefault()
    }
  })

  win.once("ready-to-show", () => win.show())
  void win.loadURL(APP_URL)
}

app.whenReady().then(() => {
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
