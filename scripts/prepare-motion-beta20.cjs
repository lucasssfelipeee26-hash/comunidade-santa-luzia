const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function fail(message) { console.error(`[motion-beta20] ${message}`); process.exit(1) }
function read(file) { if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`); return fs.readFileSync(file, "utf8") }
function write(file, content) { fs.writeFileSync(file, content) }
function requireAll(file, markers, label) { const value = read(file); for (const marker of markers) if (!value.includes(marker)) fail(`${label}: marcador ausente: ${marker}`); return value }
function removeIfExists(file) { if (fs.existsSync(file)) fs.rmSync(file, { force: true }) }
function normalizeMinifiedJs(text) {
  return String(text)
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
if (config.versionName !== "2.0.0-beta.20" || config.versionCode !== 20020) fail(`Beta 20/code20020 esperada, encontrado ${config.versionName}/code${config.versionCode}.`)
if (config.applicationId !== "br.com.comunidadesantaluzia.motionbeta") fail("Pacote Motion Beta isolado incorreto.")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) fail(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}.`)

const gradle = path.join(root, "android", "app", "build.gradle")
let gradleText = read(gradle)
gradleText = gradleText.replace(/applicationId\s+["'][^"']+["']/, `applicationId "${config.applicationId}"`)
gradleText = gradleText.replace(/versionCode\s+\d+/, `versionCode ${config.versionCode}`)
gradleText = gradleText.replace(/versionName\s+["'][^"']+["']/, `versionName "${config.versionName}"`)

// Esta Beta é somente de teste. O build release usa a assinatura de teste do Android,
// mas mantém debuggable=false. A futura promoção oficial terá a assinatura oficial.
const hardenedRelease = `release {\n            debuggable false\n            signingConfig signingConfigs.debug\n            minifyEnabled true\n            shrinkResources true\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n        }`
if (/release\s*\{[\s\S]*?\n\s*\}/m.test(gradleText)) {
  gradleText = gradleText.replace(/release\s*\{[\s\S]*?\n\s*\}/m, hardenedRelease)
} else if (/buildTypes\s*\{/.test(gradleText)) {
  gradleText = gradleText.replace(/buildTypes\s*\{/, `buildTypes {\n        ${hardenedRelease}`)
} else {
  fail("buildTypes/release não encontrado no Gradle gerado.")
}
write(gradle, gradleText)

const strings = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml")
let stringsText = read(strings)
for (const key of ["app_name", "title_activity_main"]) {
  const pattern = new RegExp(`<string name=["']${key}["']>[\\s\\S]*?<\\/string>`)
  if (pattern.test(stringsText)) stringsText = stringsText.replace(pattern, `<string name="${key}">${config.appName}</string>`)
}
write(strings, stringsText)

const manifestFile = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml")
let manifest = read(manifestFile)
manifest = manifest.replace('android:launchMode="singleTask"', 'android:launchMode="singleTop"')
manifest = manifest.replace(/<activity([\s\S]*?android:name="\.MainActivity"[\s\S]*?)>/m, (tag) => {
  let value = tag
  if (!value.includes('android:screenOrientation=')) value = value.replace(/>$/, '\n            android:screenOrientation="portrait">')
  return value
})
write(manifestFile, manifest)

const assets = path.join(root, "android", "app", "src", "main", "assets", "public")
const localApp = path.join(assets, "local-app.js")
if (!fs.existsSync(localApp) || fs.statSync(localApp).size < 250000) fail("Bundle React local ausente ou incompleto.")
const localText = normalizeMinifiedJs(read(localApp))
for (const marker of [
  "Centro Litúrgico", "Escala do Dia", "Biblioteca", "Liturgia Diária",
  "data-home-public-shortcuts", "data-original-home-icon", "data-hero-mobile-framed",
  "data-auditor-santa-luzia", "data-deep-auditor-ui", "data-team-profile-status-rail",
  "data-escala-history-search", "data-standard-logout", "Deseja sair?", "Sim, sair",
]) if (!localText.includes(marker)) fail(`Bundle React Beta 20 sem marcador obrigatório: ${marker}`)
for (const forbidden of ["DoorTransitionScene", "ProfileDoorIcon", "data-door-scene"]) if (localText.includes(forbidden)) fail(`Regressão de animação antiga reapareceu: ${forbidden}`)

const index = path.join(assets, "index.html")
const html = requireAll(index, ["/motion/android-motion-runtime-beta20.js", "/local-app.js"], "HTML local")
const motionTags = [...html.matchAll(/<script\s+defer\s+src="\/motion\/([^"]+\.js)"/g)].map((m) => m[1])
if (motionTags.length !== 1 || motionTags[0] !== "android-motion-runtime-beta20.js") fail(`Stack Motion ainda fragmentada: ${motionTags.join(", ")}`)
if (html.indexOf("/motion/android-motion-runtime-beta20.js") > html.indexOf("/local-app.js")) fail("Runtime Motion consolidado está depois do React local.")
const consolidated = path.join(assets, "motion", "android-motion-runtime-beta20.js")
requireAll(consolidated, [
  "android-beta19-regression-fix.js",
  "android-motion-beta.js",
  "android-auditor-beta12.js",
  "android-podium-beta12.js",
], "Runtime Motion consolidado")

removeIfExists(path.join(assets, "cordova.js"))
removeIfExists(path.join(assets, "cordova_plugins.js"))
const cordovaConfig = path.join(root, "android", "app", "src", "main", "res", "xml", "config.xml")
if (fs.existsSync(cordovaConfig)) {
  const text = fs.readFileSync(cordovaConfig, "utf8")
  if (/widget|access\s+origin/i.test(text)) removeIfExists(cordovaConfig)
}
for (const image of ["_franciscoxavier.jpg", "_santaagueda.jpg", "_santoambrosio.jpg"]) removeIfExists(path.join(assets, image))

const iliturgiaManifestFile = path.join(assets, "offline", "iliturgia", "manifest.json")
const iliturgiaManifest = JSON.parse(read(iliturgiaManifestFile))
if (!iliturgiaManifest.offline || !iliturgiaManifest.embedded || iliturgiaManifest.androidAssetTransport !== "binary-v1") fail("Acervo litúrgico não está no transporte binário offline.")
if (iliturgiaManifest.beta !== config.versionName) fail(`Manifesto litúrgico pertence a ${iliturgiaManifest.beta || "versão desconhecida"}.`)
const packs = iliturgiaManifest.categorias.flatMap((categoria) => categoria.arquivos || [])
if (!packs.length || packs.some((name) => !String(name).endsWith(".bin"))) fail("Manifesto ainda referencia pacote GZIP servido diretamente.")
for (const pack of ["oficio-01.html.json.bin", "oficio-10.html.json.bin", "lecionario.html.json.bin", "missal.html.json.bin", "gerais.html.json.bin"]) {
  const file = path.join(assets, "offline", "iliturgia", pack)
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) fail(`Pacote offline crítico ausente: ${pack}`)
}

const capConfigFile = path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json")
const capConfig = JSON.parse(read(capConfigFile))
capConfig.appId = config.applicationId
capConfig.appName = config.appName
if (capConfig.server) delete capConfig.server
if (!capConfig.android) capConfig.android = {}
capConfig.android.appendUserAgent = ` SantaLuziaAndroid SantaLuziaMotionBeta/${config.versionName} SantaLuziaOriginalUIOffline/2 SantaLuziaWindowsBeta/0.1.0-beta.20`
write(capConfigFile, `${JSON.stringify(capConfig, null, 2)}\n`)

const main = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "MainActivity.java")
requireAll(main, ["OfflineStorePlugin.class", "SyncHttpPlugin.class", "DiagnosticReportPlugin.class", "LOAD_DEFAULT"], "MainActivity")
requireAll(path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "OfflineStorePlugin.java"), ["DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA integrity_check", "recoverDocument"], "SQLite")
const updater = path.join(root, "android", "app", "src", "main", "java", "br", "com", "comunidadesantaluzia", "app", "AppUpdaterPlugin.java")
requireAll(updater, ["expectedSha256", "getExternalFilesDir", "MessageDigest.isEqual", "GET_SIGNING_CERTIFICATES", "assinaturaInstalada.equals(assinaturaCandidata)"], "Atualizador seguro")

const finalGradle = read(gradle)
for (const marker of [
  `applicationId "${config.applicationId}"`,
  "versionCode 20020",
  'versionName "2.0.0-beta.20"',
  "debuggable false",
  "signingConfig signingConfigs.debug",
  "minifyEnabled true",
  "shrinkResources true",
]) if (!finalGradle.includes(marker)) fail(`Gradle Beta 20 sem marcador: ${marker}`)
const finalManifest = read(manifestFile)
if (!finalManifest.includes('android:launchMode="singleTop"')) fail("MainActivity não foi corrigida para singleTop.")
if (!finalManifest.includes('android:screenOrientation="portrait"')) fail("Orientação da MainActivity não foi fixada em portrait.")

const finalCap = JSON.parse(read(capConfigFile))
if (finalCap.appId !== config.applicationId) fail(`Capacitor appId divergente: ${finalCap.appId}`)
if (finalCap.server) fail("Motion Beta não pode conter server.url no Capacitor.")
if (!String(finalCap.android?.appendUserAgent || "").includes(config.versionName)) fail("User-Agent Motion Beta 20 não aplicado.")
if (fs.existsSync(path.join(assets, "cordova.js")) || fs.existsSync(path.join(assets, "cordova_plugins.js")) || fs.existsSync(cordovaConfig)) fail("Resíduo Cordova permaneceu no projeto Android.")

console.log("[motion-beta20] Auditoria estrutural aplicada: release não depurável, pacote alinhado, R8/shrink, Cordova removido, singleTask corrigido, runtime Motion consolidado e acervo offline preservado.")
