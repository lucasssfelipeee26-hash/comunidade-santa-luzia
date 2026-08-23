const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
function fail(message) { console.error(`[motion-beta] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireMarkers(text, markers, label) { for (const marker of markers) if (!text.includes(marker)) fail(`${label}: marcador ausente: ${marker}`) }
function assertJs(text, label) { try { new Function(text) } catch (error) { fail(`${label}: JavaScript inválido: ${error.message}`) } }

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.9" || config.versionCode !== 20009) fail("Configuração deve ser Beta 9/code20009.")

const gradle = path.join(root, "android", "app", "build.gradle")
let gradleText = read(gradle)
gradleText = gradleText.replace(/applicationId\s+["'][^"']+["']/, `applicationId "${config.applicationId}"`)
gradleText = gradleText.replace(/versionCode\s+\d+/, `versionCode ${config.versionCode}`)
gradleText = gradleText.replace(/versionName\s+["'][^"']+["']/, `versionName "${config.versionName}"`)
write(gradle, gradleText)

const strings = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml")
let stringsText = read(strings)
for (const key of ["app_name", "title_activity_main"]) {
  const pattern = new RegExp(`<string name=["']${key}["']>[\\s\\S]*?<\\/string>`)
  if (pattern.test(stringsText)) stringsText = stringsText.replace(pattern, `<string name="${key}">${config.appName}</string>`)
}
write(strings, stringsText)

const assets = path.join(root, "android", "app", "src", "main", "assets", "public")
const index = read(path.join(assets, "index.html"))
const appJs = read(path.join(assets, "app.js"))
const quizJs = read(path.join(assets, "quiz-local.js"))
const css = read(path.join(assets, "app.css"))
assertJs(appJs, "Shell local Beta 9")
assertJs(quizJs, "Quiz local Beta 9")
requireMarkers(index, ["app.css", "app.js", "quiz-local.js"], "index local")
requireMarkers(appJs, ["2.0.0-beta.9", "OfflineStore", "SyncHttp", "flushQueue", "loadLocalLiturgia", "renderAtrasos", "renderPresencas"], "shell local")
requireMarkers(quizJs, ["/api/quizzes/liturgia/offline", "saveQueue"], "quiz local")
requireMarkers(css, ["@keyframes trophy", "@keyframes float3d", ".podium"], "animações locais")

const capConfig = read(path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json"))
let parsed
try { parsed = JSON.parse(capConfig) } catch { fail("capacitor.config.json inválido no APK.") }
if (parsed.server?.url) fail(`Beta 9 não pode conter server.url: ${parsed.server.url}`)
if (String(parsed.android?.appendUserAgent || "").indexOf("SantaLuziaLocalFirst/1") < 0) fail("User-Agent local-first ausente.")

const main = read(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java"))
requireMarkers(main, ["SyncHttpPlugin.class", "OfflineStorePlugin.class", "CaminhoDaLuzPlugin.class", "WhatajongPlugin.class"], "MainActivity")
if (/evaluateJavascript|android-local-first-beta8|android-offline-first-beta7/.test(main)) fail("MainActivity ainda injeta runtime do site remoto.")

for (const java of ["SyncHttpPlugin.java", "OfflineStorePlugin.java"]) {
  const file = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", java)
  if (!fs.existsSync(file)) fail(`${java} não foi copiado para o projeto Android.`)
}

const liturgia = path.join(assets, "offline", "liturgia-completa", "2026-08.json")
if (!fs.existsSync(liturgia)) fail("Pacote local da Liturgia de agosto/2026 ausente.")
const whatajong = path.join(assets, "whatajong", "index.html")
if (!fs.existsSync(whatajong)) fail("Whatajong local ausente.")

console.log(`[motion-beta] Beta 9 local pronta: ${config.applicationId} ${config.versionName} (code ${config.versionCode}).`)
console.log("[motion-beta] WebView sem server.url; SQLite + SyncHttp + Liturgia + jogos empacotados localmente.")
