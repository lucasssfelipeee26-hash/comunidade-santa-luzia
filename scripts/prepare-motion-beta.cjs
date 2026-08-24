const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
function fail(message) { console.error(`[motion-beta10] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function gitBlobSha(buffer) { return crypto.createHash("sha1").update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest("hex") }
function assertJavascript(content, label) { try { new Function(content) } catch (error) { fail(`${label}: JavaScript inválido: ${error instanceof Error ? error.message : String(error)}`) } }

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.10" || config.versionCode !== 20010) fail(`Configuração Beta 10 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
if (config.applicationId !== "br.com.comunidadesantaluzia.motionbeta") fail("Pacote Beta isolado incorreto.")

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
const motionDir = path.join(assets, "motion")
const windows = {
  motionCss: ["windows-motion-fixes.css", config.windowsBeta.files.motionCss],
  behavior: ["windows-behavior-fixes.js", config.windowsBeta.files.behavior],
  polish: ["windows-beta7-polish.js", config.windowsBeta.files.polish],
  preload: ["windows-preload-v5.js", config.windowsBeta.files.preload],
  runtime: ["windows-beta-runtime.js", config.windowsBeta.files.runtime],
}
for (const [key, [name, meta]] of Object.entries(windows)) {
  const file = path.join(motionDir, name)
  if (!fs.existsSync(file)) fail(`Camada Windows ${key} ausente.`)
  const bytes = fs.readFileSync(file)
  if (gitBlobSha(bytes) !== meta.blobSha) fail(`${key}: conteúdo diferente da Windows Beta 0.1.0-beta.19.`)
  if (meta.size && bytes.length !== meta.size) fail(`${key}: tamanho incorreto.`)
  if (meta.sha256 && crypto.createHash("sha256").update(bytes).digest("hex") !== meta.sha256) fail(`${key}: SHA-256 incorreto.`)
}

const jsRequired = {
  "android-motion-beta.js": ["Santa Luzia"],
  "android-native-fetch-beta10.js": ["2.0.0-beta.10", "SyncHttp", "formDataJson", "bodyBase64"],
  "android-local-first-beta8.js": ["motionLocalFirstFetch", "createQueuedMutation", "replayQueue", "indexedDB"],
  "android-member-state-beta8.js": ["motionMemberStateFetch", "/promover", "/registros"],
  "android-domain-bridge-beta10.js": ["2.0.0-beta.10", "reportar_atraso", "minha-presenca", "moderar_atraso", "optimisticAdminQuiz", "optimisticTheme"],
  "android-local-navigation-beta10.js": ["2.0.0-beta.10", "santa-luzia:local-route", "downloadApi", "/api/"],
  "android-original-ui-beta10.js": ["2.0.0-beta.10", "/api/auth/me", "/api/escalas", "/api/formacoes", "/api/ranking"],
}
for (const [name, markers] of Object.entries(jsRequired)) {
  const text = read(path.join(motionDir, name))
  assertJavascript(text, name)
  for (const marker of markers) if (!text.includes(marker)) fail(`${name} sem marcador obrigatório: ${marker}`)
}

const localApp = path.join(assets, "local-app.js")
if (!fs.existsSync(localApp) || fs.statSync(localApp).size < 250000) fail("Bundle React original local ausente ou incompleto.")
const index = read(path.join(assets, "index.html"))
for (const marker of ["/local-app.js", "android-native-fetch-beta10.js", "android-local-first-beta8.js", "android-domain-bridge-beta10.js", "android-local-navigation-beta10.js", "windows-beta-runtime.js"]) if (!index.includes(marker)) fail(`index.html local sem ${marker}`)
if (/offline\.html|offline-bridge\.html/.test(index)) fail("index.html referencia interface offline paralela.")

const capConfig = read(path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json"))
if (/"server"\s*:/.test(capConfig)) fail("Motion Beta 10 não pode conter server.url no Capacitor.")
if (!capConfig.includes(`SantaLuziaMotionBeta/${config.versionName}`)) fail("User-Agent Beta 10 ausente.")
if (!capConfig.includes("SantaLuziaWindowsBeta/0.1.0-beta.19")) fail("Identidade da Windows Beta 19 ausente.")

const main = read(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java"))
for (const marker of [config.applicationId, "SyncHttpPlugin.class", "OfflineStorePlugin.class", "CaminhoDaLuzPlugin.class", "WhatajongPlugin.class", "LOAD_DEFAULT"]) if (!main.includes(marker)) fail(`MainActivity sem marcador: ${marker}`)
for (const forbidden of ["MotionOfflineWebViewClient", "evaluateJavascript", "LOAD_CACHE_ELSE_NETWORK"]) if (main.includes(forbidden)) fail(`MainActivity ainda contém arquitetura remota antiga: ${forbidden}`)

const syncHttp = read(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "SyncHttpPlugin.java"))
for (const marker of ["multipart/form-data", "bodyBase64", "formDataJson", "CookieManager", "completedRound", "SantaLuziaWindowsBeta/0.1.0-beta.19"]) if (!syncHttp.includes(marker)) fail(`SyncHttp sem marcador: ${marker}`)

if (!new RegExp(`applicationId\\s+["']${config.applicationId.replace(/\./g, "\\.")}["']`).test(read(gradle))) fail("applicationId Beta não aplicado.")
if (!read(strings).includes(config.appName)) fail("Nome Motion Beta não aplicado.")
console.log(`[motion-beta10] ${config.versionName}/code${config.versionCode}: frontend React original local + Windows Beta 19 + fila local-first + regras de domínio + SyncHttp validados.`)
