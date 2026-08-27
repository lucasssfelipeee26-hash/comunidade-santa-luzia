const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function fail(message) { console.error(`[motion-beta16] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireAll(file, markers, label) { const text = read(file); for (const marker of markers) if (!text.includes(marker)) fail(`${label}: marcador ausente: ${marker}`); return text }

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.16" || config.versionCode !== 20016) fail(`Beta 16/code20016 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
if (config.applicationId !== "br.com.comunidadesantaluzia.motionbeta") fail("Pacote Beta isolado incorreto.")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) fail(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}.`)

const signingEnv = {
  keystore: process.env.MOTION_BETA_KEYSTORE,
  storePassword: process.env.MOTION_BETA_STORE_PASSWORD,
  keyAlias: process.env.MOTION_BETA_KEY_ALIAS,
  keyPassword: process.env.MOTION_BETA_KEY_PASSWORD,
}
for (const [key, value] of Object.entries(signingEnv)) if (!value) fail(`Variável de assinatura ausente: ${key}`)
if (!fs.existsSync(signingEnv.keystore) || fs.statSync(signingEnv.keystore).size < 1000) fail("Keystore persistente da Motion Beta ausente ou inválido.")

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
if (!fs.existsSync(localApp) || fs.statSync(localApp).size < 250000) fail("Bundle React local ausente ou incompleto.")
requireAll(localApp, ["data-auditor-santa-luzia", "data-deep-auditor-ui", "android-deep-auditor-beta16.js", "data-profile-viewer-banner", "data-profile-scroll", "data-bottom-nav-network-stable"], "Bundle React Beta 16")

const deep = path.join(assets, "motion", "android-deep-auditor-beta16.js")
const patch = path.join(assets, "motion", "android-auditor-patch-beta16.js")
requireAll(deep, ["SantaLuziaDeepAudit", "sendGlitchTip", "profile-dialog-collapsed", "application/x-sentry-envelope"], "Deep Scan empacotado")
requireAll(patch, ["santa-luzia-diagnostico-v3", "compactEvents", "deepAudit", "saveReport"], "Patch do relatório empacotado")

const capConfigFile = path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json")
const capConfig = read(capConfigFile)
if (/"server"\s*:/.test(capConfig)) fail("Motion Beta não pode conter server.url.")
for (const marker of [`SantaLuziaMotionBeta/${config.versionName}`, "SantaLuziaOriginalUIOffline/2"]) if (!capConfig.includes(marker)) fail(`Identidade local ausente: ${marker}`)

const main = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java")
requireAll(main, ["OfflineStorePlugin.class", "DiagnosticReportPlugin.class", "setVerticalScrollBarEnabled(true)", "setScrollbarFadingEnabled(false)", "LOAD_DEFAULT"], "MainActivity")
const reportPlugin = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "DiagnosticReportPlugin.java")
requireAll(reportPlugin, ["saveReport", "shareLastReport", "FileProvider.getUriForFile"], "Relatório nativo")
const offlineStore = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "OfflineStorePlugin.java")
requireAll(offlineStore, ["DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA integrity_check", "recoverDocument"], "SQLite")

const gradleFinal = read(gradle)
if (!new RegExp(`applicationId\\s+["']${config.applicationId.replace(/\./g, "\\.")}["']`).test(gradleFinal)) fail("applicationId Beta não aplicado.")
if (!new RegExp(`versionCode\\s+${config.versionCode}`).test(gradleFinal)) fail("versionCode Beta 16 não aplicado.")
if (!gradleFinal.includes(`versionName "${config.versionName}"`)) fail("versionName Beta 16 não aplicado.")
if (!gradleFinal.includes("signingConfig signingConfigs.motionBeta")) fail("Assinatura Beta não aplicada.")

console.log(`[motion-beta16] ${config.versionName}/code${config.versionCode}: Deep Scan, ponte GlitchTip, perfis, navegação, relatório nativo, SQLite e assinatura validados; estável 1.0.6/code18 preservado.`)
