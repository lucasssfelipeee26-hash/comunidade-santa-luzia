const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function fail(message) { console.error(`[motion-beta17] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireAll(file, markers, label) { const text = read(file); for (const marker of markers) if (!text.includes(marker)) fail(`${label}: marcador ausente: ${marker}`); return text }

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.17" || config.versionCode !== 20017) fail(`Beta 17/code20017 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
if (config.applicationId !== "br.com.comunidadesantaluzia.motionbeta") fail("ApplicationId Beta incorreto.")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) fail(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}.`)

const signingEnv = {
  keystore: process.env.MOTION_BETA_KEYSTORE,
  storePassword: process.env.MOTION_BETA_STORE_PASSWORD,
  keyAlias: process.env.MOTION_BETA_KEY_ALIAS,
  keyPassword: process.env.MOTION_BETA_KEY_PASSWORD,
}
for (const [key, value] of Object.entries(signingEnv)) if (!value) fail(`Variável de assinatura ausente: ${key}`)
if (!fs.existsSync(signingEnv.keystore) || fs.statSync(signingEnv.keystore).size < 1000) fail("Keystore persistente ausente ou inválido.")

const gradle = path.join(root, "android", "app", "build.gradle")
let gradleText = read(gradle)
gradleText = gradleText.replace(/applicationId\s+["'][^"']+["']/, `applicationId "${config.applicationId}"`)
gradleText = gradleText.replace(/versionCode\s+\d+/, `versionCode ${config.versionCode}`)
gradleText = gradleText.replace(/versionName\s+["'][^"']+["']/, `versionName "${config.versionName}"`)
const signingBlock = `    signingConfigs {\n        motionBeta {\n            storeFile file(System.getenv("MOTION_BETA_KEYSTORE"))\n            storePassword System.getenv("MOTION_BETA_STORE_PASSWORD")\n            keyAlias System.getenv("MOTION_BETA_KEY_ALIAS")\n            keyPassword System.getenv("MOTION_BETA_KEY_PASSWORD")\n        }\n    }\n`
if (!gradleText.includes("signingConfigs {")) gradleText = gradleText.replace(/(\s+defaultConfig\s*\{)/, `\n${signingBlock}$1`)
if (!gradleText.includes("signingConfig signingConfigs.motionBeta")) gradleText = gradleText.replace(/(\s+buildTypes\s*\{)/, `$1\n        debug {\n            signingConfig signingConfigs.motionBeta\n        }`)
write(gradle, gradleText)

const strings = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml")
let stringsText = read(strings)
for (const key of ["app_name", "title_activity_main"]) {
  const pattern = new RegExp(`<string name=["']${key}["']>[\\s\\S]*?<\\/string>`)
  if (pattern.test(stringsText)) stringsText = stringsText.replace(pattern, `<string name="${key}">${config.appName}</string>`)
}
write(strings, stringsText)

const assets = path.join(root, "android", "app", "src", "main", "assets", "public")
const localApp = path.join(assets, "local-app.js")
const index = path.join(assets, "index.html")
if (!fs.existsSync(localApp) || fs.statSync(localApp).size < 250000) fail("Bundle React local ausente ou incompleto.")
requireAll(localApp, ["data-auditor-santa-luzia", "data-bottom-nav-network-stable", "data-profile-viewer-banner"], "Bundle local")
const html = read(index)
for (const forbidden of ["windows-behavior-fixes.js", "windows-beta7-polish.js", "windows-preload-v5.js", "windows-beta-runtime.js", "windows-motion-fixes.css"]) {
  if (html.includes(forbidden)) fail(`Stack Windows ainda executável no Android: ${forbidden}`)
}
requireAll(path.join(assets, "motion", "android-auditor-patch-beta16.js"), ["2.0.0-beta.17", "unique-signatures", "deleteLastReport", "santa-luzia-diagnostico-v4"], "Patch Auditor")
requireAll(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "DiagnosticReportPlugin.java"), ["deleteLastReport", "shareLastReport"], "Plugin relatório")
requireAll(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "OfflineStorePlugin.java"), ["PRAGMA integrity_check", "setWriteAheadLoggingEnabled(true)"], "SQLite")

const capConfig = read(path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json"))
if (/"server"\s*:/.test(capConfig)) fail("Motion Beta não pode conter server.url.")
if (!capConfig.includes(`SantaLuziaMotionBeta/${config.versionName}`)) fail("User-Agent Beta 17 ausente.")
if (capConfig.includes("SantaLuziaWindowsBeta/")) fail("User-Agent Android ainda carrega identidade Windows.")

const gradleFinal = read(gradle)
if (!gradleFinal.includes(`applicationId "${config.applicationId}"`)) fail("applicationId não aplicado.")
if (!gradleFinal.includes(`versionCode ${config.versionCode}`)) fail("versionCode não aplicado.")
if (!gradleFinal.includes(`versionName "${config.versionName}"`)) fail("versionName não aplicado.")
if (!gradleFinal.includes("signingConfig signingConfigs.motionBeta")) fail("Assinatura Beta não aplicada.")

console.log(`[motion-beta17] ${config.versionName}/code${config.versionCode}: Auditor único, relatório removível, stack Windows desativada no Android, fila nativa e assinatura validados; estável 1.0.6/code18 preservado.`)
