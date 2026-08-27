const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function fail(message) { console.error(`[motion-beta18] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireAll(file, markers, label) { const text = read(file); for (const marker of markers) if (!text.includes(marker)) fail(`${label}: marcador ausente: ${marker}`); return text }
function forbid(file, markers, label) { const text = read(file); for (const marker of markers) if (text.includes(marker)) fail(`${label}: conteúdo proibido: ${marker}`) }

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.18" || config.versionCode !== 20018) fail(`Beta 18/code20018 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
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

// O bundle React é minificado pelo esbuild. Por isso a inspeção do APK exige
// nomes dos data-attributes e conteúdos funcionais, sem depender de uma forma
// textual específica como data-x=\"true\" que pode ser reescrita pelo minificador.
requireAll(localApp, [
  "data-auditor-santa-luzia",
  "data-deep-auditor-ui",
  "android-deep-auditor-beta16.js",
  "data-profile-viewer-banner",
  "data-profile-close",
  "data-profile-scroll",
  "data-team-profile-status-rail",
  "Buscar perfil por nome",
  "data-bottom-nav-network-stable",
  "mobile-app-bottom-nav",
  "data-home-public-shortcuts",
  "Centro Litúrgico",
  "Escala do Dia",
  "Biblioteca",
  "Liturgia Diária",
  "data-hero-clean-image",
  "data-main-profile-access",
  "Administração de dados",
  "data-escala-history-search",
  "data-escala-filter-date",
  "data-escala-filter-season",
  "Próxima escala",
  "data-standard-logout",
  "data-logout-confirmation",
  "Deseja sair?",
  "Sim, sair",
  "slR11Panel",
  "slR10ScaleMotion",
  "slR11Page",
  "slR11Library",
  "slR11Quiz",
], "Bundle React Beta 18 — exigências das imagens/vídeo")
forbid(localApp, ["DoorTransitionScene", "ProfileDoorIcon", "data-door-scene", "Eventos recentes", "Versão monitorada", "Dados locais", "Banco SQLite", "Tela atual"], "Bundle React Beta 18")

const runtime = path.join(assets, "motion", "windows-beta-runtime.js")
const polish = path.join(assets, "motion", "windows-beta7-polish.js")
requireAll(runtime, ['[data-sl-nav-motion="panel"] svg', "slR11Panel", "slR11Quiz", "slR10ScaleMotion", "slR11Page"], "Runtime de animações originais")
requireAll(polish, ["restoreAndroidBottomNav()", 'window.addEventListener("resize", () => restoreAndroidBottomNav());'], "Polish Android corrigido")
if (/\bupdateBottomNav\s*\(/.test(read(polish))) fail("Polish ainda contém updateBottomNav executável.")

const deep = path.join(assets, "motion", "android-deep-auditor-beta16.js")
const patch = path.join(assets, "motion", "android-auditor-patch-beta16.js")
requireAll(deep, ["SantaLuziaDeepAudit", "sendGlitchTip", "profile-dialog-collapsed", "application/x-sentry-envelope"], "Deep Scan empacotado")
requireAll(patch, ["2.0.0-beta.18", "santa-luzia-diagnostico-v4", "unique-signatures", "occurrences", "CLEAN_VERSION_KEY"], "Auditor Beta 18")

const capConfigFile = path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json")
const capConfig = read(capConfigFile)
if (/"server"\s*:/.test(capConfig)) fail("Motion Beta não pode conter server.url.")
for (const marker of [`SantaLuziaMotionBeta/${config.versionName}`, "SantaLuziaOriginalUIOffline/2"]) if (!capConfig.includes(marker)) fail(`Identidade local ausente: ${marker}`)

const main = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java")
requireAll(main, ["OfflineStorePlugin.class", "DiagnosticReportPlugin.class", "setVerticalScrollBarEnabled(true)", "setScrollbarFadingEnabled(false)", "LOAD_DEFAULT"], "MainActivity")
const reportPlugin = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "DiagnosticReportPlugin.java")
requireAll(reportPlugin, ["saveReport", "shareLastReport", "deleteLastReport", "FileProvider.getUriForFile"], "Relatório nativo")
const offlineStore = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "OfflineStorePlugin.java")
requireAll(offlineStore, ["DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA integrity_check", "recoverDocument"], "SQLite")

const gradleFinal = read(gradle)
if (!new RegExp(`applicationId\\s+["']${config.applicationId.replace(/\./g, "\\.")}["']`).test(gradleFinal)) fail("applicationId Beta não aplicado.")
if (!new RegExp(`versionCode\\s+${config.versionCode}`).test(gradleFinal)) fail("versionCode Beta 18 não aplicado.")
if (!gradleFinal.includes(`versionName "${config.versionName}"`)) fail("versionName Beta 18 não aplicado.")
if (!gradleFinal.includes("signingConfig signingConfigs.motionBeta")) fail("Assinatura Beta não aplicada.")

console.log(`[motion-beta18] ${config.versionName}/code${config.versionCode}: exigências das imagens/vídeo, barra e animações originais, Perfis, Escalas, logout, Auditor, fila e offline validados no pacote; estável 1.0.6/code18 preservado.`)
