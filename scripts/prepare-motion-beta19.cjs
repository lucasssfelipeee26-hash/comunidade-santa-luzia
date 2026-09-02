const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function fail(message) { console.error(`[motion-beta19] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireAll(file, markers, label) { const value = read(file); for (const marker of markers) if (!value.includes(marker)) fail(`${label}: marcador ausente: ${marker}`); return value }
function normalizeMinifiedJs(text) {
  return String(text)
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.19" || config.versionCode !== 20019) fail(`Beta 19/code20019 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
if (config.applicationId !== "br.com.comunidadesantaluzia.motionbeta") fail("Pacote Motion Beta isolado incorreto.")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) fail(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}.`)

const signing = {
  keystore: process.env.MOTION_BETA_KEYSTORE,
  storePassword: process.env.MOTION_BETA_STORE_PASSWORD,
  keyAlias: process.env.MOTION_BETA_KEY_ALIAS,
  keyPassword: process.env.MOTION_BETA_KEY_PASSWORD,
}
for (const [key, value] of Object.entries(signing)) if (!value) fail(`Variável de assinatura ausente: ${key}`)
if (!fs.existsSync(signing.keystore) || fs.statSync(signing.keystore).size < 1000) fail("Keystore persistente da Motion Beta ausente ou inválido.")

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
const localText = normalizeMinifiedJs(read(localApp))
for (const marker of [
  "Centro Litúrgico", "Escala do Dia", "Biblioteca", "Liturgia Diária",
  "data-home-public-shortcuts", "data-original-home-icon", "data-hero-mobile-framed",
  "data-auditor-santa-luzia", "data-deep-auditor-ui", "data-team-profile-status-rail",
  "data-escala-history-search", "data-standard-logout", "Deseja sair?", "Sim, sair",
  "slR11Panel", "slR10ScaleMotion", "slR11Page", "slR11Library", "slR11Quiz",
]) if (!localText.includes(marker)) fail(`Bundle React Beta 19 sem marcador obrigatório: ${marker}`)
for (const forbidden of ["DoorTransitionScene", "ProfileDoorIcon", "data-door-scene"]) if (localText.includes(forbidden)) fail(`Regressão de animação antiga reapareceu: ${forbidden}`)

const index = path.join(assets, "index.html")
requireAll(index, [
  "/motion/android-motion-beta.js",
  "/motion/android-beta19-regression-fix.js",
  "/motion/android-deep-auditor-beta16.js",
  "/motion/android-auditor-patch-beta16.js",
  "/local-app.js",
], "HTML local")
const html = read(index)
if (!(html.indexOf("/motion/android-motion-beta.js") < html.indexOf("/motion/android-beta19-regression-fix.js") && html.indexOf("/motion/android-beta19-regression-fix.js") < html.indexOf("/local-app.js"))) fail("Patch Beta 19 está fora da ordem correta.")

const regression = path.join(assets, "motion", "android-beta19-regression-fix.js")
requireAll(regression, ["data-sl-home-generated-fourth", "sl-home-runtime-icon", "data-original-home-icon", "data-home-shortcut-id"], "Correção visual Beta 19")
const windowsRuntime = path.join(assets, "motion", "windows-beta-runtime.js")
requireAll(windowsRuntime, ["slR11Panel", "slR11Quiz", "slR10ScaleMotion", "slR11Page"], "Runtime histórico de animações")
requireAll(path.join(assets, "motion", "android-deep-auditor-beta16.js"), ["SantaLuziaDeepAudit", "sendGlitchTip", "profile-dialog-collapsed"], "Deep Scan")
requireAll(path.join(assets, "motion", "android-auditor-patch-beta16.js"), ["santa-luzia-diagnostico-v4", "unique-signatures", "occurrences"], "Auditor")

const manifest = JSON.parse(read(path.join(assets, "offline", "iliturgia", "manifest.json")))
if (!manifest.offline || !manifest.embedded || manifest.androidAssetTransport !== "binary-v1") fail("Acervo litúrgico não está no transporte binário offline Beta 19.")
const packs = manifest.categorias.flatMap((categoria) => categoria.arquivos || [])
if (!packs.length || packs.some((name) => !String(name).endsWith(".bin"))) fail("Manifesto ainda referencia pacote GZIP servido diretamente.")
for (const pack of ["oficio-01.html.json.bin", "oficio-10.html.json.bin", "lecionario.html.json.bin", "missal.html.json.bin", "gerais.html.json.bin"]) {
  const file = path.join(assets, "offline", "iliturgia", pack)
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) fail(`Pacote offline crítico ausente: ${pack}`)
}

const capConfig = read(path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json"))
if (/"server"\s*:/.test(capConfig)) fail("Motion Beta não pode conter server.url.")
if (!capConfig.includes("SantaLuziaMotionBeta/2.0.0-beta.19")) fail("Identidade Beta 19 não aplicada ao Capacitor.")

const main = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java")
requireAll(main, ["OfflineStorePlugin.class", "SyncHttpPlugin.class", "DiagnosticReportPlugin.class", "LOAD_DEFAULT"], "MainActivity")
requireAll(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "OfflineStorePlugin.java"), ["DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA integrity_check", "recoverDocument"], "SQLite")

const finalGradle = read(gradle)
if (!finalGradle.includes(`applicationId "${config.applicationId}"`) || !finalGradle.includes("versionCode 20019") || !finalGradle.includes('versionName "2.0.0-beta.19"') || !finalGradle.includes("signingConfig signingConfigs.motionBeta")) fail("Identidade/assinatura Beta 19 não aplicada no Gradle.")

console.log("[motion-beta19] Base auditada preservada; Home, hero, Biblioteca e acervo litúrgico offline corrigidos; Motion Beta 19 pronta para compilação.")
