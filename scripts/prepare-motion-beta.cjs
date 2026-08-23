const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const root = path.resolve(__dirname, "..")
const config = require(path.join(root, "config", "android-motion-beta.json"))

function fail(message) {
  console.error(`[motion-beta] ${message}`)
  process.exit(1)
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo ausente: ${path.relative(root, file)}`)
  return fs.readFileSync(file, "utf8")
}

function write(file, content) {
  fs.writeFileSync(file, content)
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório para impedir alteração acidental do app oficial.")

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

const runtimeAsset = path.join(root, "android", "app", "src", "main", "assets", "public", "motion", "windows-beta-runtime.js")
const androidPatch = path.join(root, "android", "app", "src", "main", "assets", "public", "motion", "android-motion-beta.js")
if (!fs.existsSync(runtimeAsset)) fail("Runtime Motion da Beta Windows não foi empacotado no APK.")
if (!fs.existsSync(androidPatch)) fail("Complemento Motion Android não foi empacotado no APK.")

const bytes = fs.readFileSync(runtimeAsset)
const sha = crypto.createHash("sha256").update(bytes).digest("hex")
if (bytes.length !== config.windowsMotion.size) fail(`Runtime Motion com tamanho incorreto: ${bytes.length}.`)
if (sha !== config.windowsMotion.sha256) fail(`Runtime Motion com SHA-256 incorreto: ${sha}.`)

if (!new RegExp(`applicationId\\s+["']${config.applicationId.replace(/\./g, "\\.")}["']`).test(read(gradle))) fail("applicationId da Beta não foi aplicado.")
if (!read(strings).includes(config.appName)) fail("Nome Santa Luzia Motion Beta não foi aplicado.")

console.log(`[motion-beta] Pacote isolado pronto: ${config.applicationId} ${config.versionName} (code ${config.versionCode}).`)
console.log(`[motion-beta] Runtime Motion empacotado e verificado: ${bytes.length} bytes / ${sha}.`)
