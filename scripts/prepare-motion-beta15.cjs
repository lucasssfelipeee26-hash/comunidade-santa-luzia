const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function fail(message) { console.error(`[motion-beta15] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireAll(file, markers, label) {
  const text = read(file)
  for (const marker of markers) if (!text.includes(marker)) fail(`${label}: marcador ausente: ${marker}`)
  return text
}
function forbid(file, markers, label) {
  const text = read(file)
  for (const marker of markers) if (text.includes(marker)) fail(`${label}: conteúdo cancelado/proibido: ${marker}`)
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.15" || config.versionCode !== 20015) fail(`Beta 15/code20015 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
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
requireAll(localApp, [
  "data-login-standard-icon",
  "data-standard-logout",
  "data-logout-confirmation",
  "data-bottom-nav-network-stable",
  "data-main-profile-access",
  "data-team-profile-status-rail",
  "data-profile-viewer-banner",
  "data-profile-close",
  "data-profile-photo-frame",
  "data-admin-database-tools",
  "/area-restrita/moderador/administracao",
  "data-auditor-santa-luzia",
], "Bundle React Beta 15")
forbid(localApp, ["DoorTransitionScene", "data-door-scene", "slDoorPersonEnter", "slDoorPersonExit", "ProfileDoorIcon"], "Bundle React")

const index = path.join(assets, "index.html")
requireAll(index, [
  "/local-app.js", "android-native-fetch-beta10.js", "android-local-first-beta8.js", "android-domain-bridge-beta10.js",
  "android-quiz-offline-beta10.js", "android-auditor-beta12.js", "android-performance-beta12.js", "android-scroll-stability-beta12.js", "android-podium-beta12.js", "android-motion-beta.js",
], "HTML local")
if (/offline\.html|offline-bridge\.html/.test(read(index))) fail("Interface offline paralela reapareceu no APK.")

const capConfigFile = path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json")
const capConfig = read(capConfigFile)
if (/"server"\s*:/.test(capConfig)) fail("Motion Beta não pode conter server.url.")
for (const marker of [`SantaLuziaMotionBeta/${config.versionName}`, "SantaLuziaOriginalUIOffline/2"]) if (!capConfig.includes(marker)) fail(`Identidade local ausente: ${marker}`)

const main = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java")
requireAll(main, [
  "SyncHttpPlugin.class", "OfflineStorePlugin.class", "DiagnosticReportPlugin.class", "CaminhoDaLuzPlugin.class", "WhatajongPlugin.class",
  "setVerticalScrollBarEnabled(true)", "setScrollbarFadingEnabled(false)", "LOAD_DEFAULT",
], "MainActivity Beta 15")
forbid(main, ["MotionOfflineWebViewClient", "evaluateJavascript", "LOAD_CACHE_ELSE_NETWORK"], "MainActivity")

const reportPlugin = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "DiagnosticReportPlugin.java")
requireAll(reportPlugin, ["saveReport", "shareLastReport", "MediaStore.Downloads", "FileProvider.getUriForFile"], "Exportação nativa do Auditor")
const manifest = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml")
requireAll(manifest, ["androidx.core.content.FileProvider", "${applicationId}.fileprovider", "@xml/diagnostic_file_paths"], "FileProvider")
requireAll(path.join(root, "android", "app", "src", "main", "res", "xml", "diagnostic_file_paths.xml"), ["external-files-path", "Santa-Luzia-Diagnosticos"], "Caminho de diagnóstico")

const offlineStore = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "OfflineStorePlugin.java")
requireAll(offlineStore, ["DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA synchronous=FULL", "PRAGMA integrity_check", "TABLE_BACKUPS", "recoverDocument", "beginTransaction"], "SQLite local")

const scroll = path.join(assets, "motion", "android-scroll-stability-beta12.js")
requireAll(scroll, ["native-free-scroll", "touchmove", "scroll-jump", "overflow-y:auto!important", "touch-action:pan-y"], "Rolagem vertical")
forbid(scroll, ["scrollTo({ top: target"], "Rolagem")
const auditor = path.join(assets, "motion", "android-auditor-beta12.js")
if (fs.statSync(auditor).size < 15000) fail("Auditor empacotado parece truncado/incompleto.")
requireAll(auditor, ["2.0.0-beta.15", "runSelfAudit", "exportReport", "shareLastReport", "offlineReadinessAudit", "onlineEndpointAudit", "/api/app/admin-dados", "missing-icons", "scroll-jump", "fps-sample"], "Auditor Santa Luzia")
const motion = path.join(assets, "motion", "android-motion-beta.js")
requireAll(motion, ["2.0.0-beta.15", "ensureFourthHomeCard", "ensureScaleHistorySearch", "data-scale-history-search", "Tempo litúrgico", "sl-home-runtime-icon"], "Motion Beta 15")

const gradleFinal = read(gradle)
if (!new RegExp(`applicationId\\s+["']${config.applicationId.replace(/\./g, "\\.")}["']`).test(gradleFinal)) fail("applicationId Beta não aplicado.")
if (!new RegExp(`versionCode\\s+${config.versionCode}`).test(gradleFinal)) fail("versionCode Beta 15 não aplicado.")
if (!gradleFinal.includes(`versionName "${config.versionName}"`)) fail("versionName Beta 15 não aplicado.")
for (const marker of ["signingConfigs", "motionBeta", "MOTION_BETA_KEYSTORE", "signingConfig signingConfigs.motionBeta"]) if (!gradleFinal.includes(marker)) fail(`Assinatura persistente ausente: ${marker}`)
if (!read(strings).includes(config.appName)) fail("Nome Motion Beta não aplicado.")

console.log(`[motion-beta15] ${config.versionName}/code${config.versionCode}: pacote local, navegação, Home, perfis, escalas, Auditor, rolagem, administração, SQLite e assinatura validados; animação cancelada ausente; estável 1.0.6/code18 preservado.`)
