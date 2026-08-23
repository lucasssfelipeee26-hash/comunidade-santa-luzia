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

function gitBlobSha(buffer) {
  return crypto.createHash("sha1").update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest("hex")
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

const motionDir = path.join(root, "android", "app", "src", "main", "assets", "public", "motion")
const required = {
  motionCss: ["windows-motion-fixes.css", config.windowsBeta.files.motionCss],
  behavior: ["windows-behavior-fixes.js", config.windowsBeta.files.behavior],
  polish: ["windows-beta7-polish.js", config.windowsBeta.files.polish],
  preload: ["windows-preload-v5.js", config.windowsBeta.files.preload],
  runtime: ["windows-beta-runtime.js", config.windowsBeta.files.runtime],
}
for (const [key, [name, meta]] of Object.entries(required)) {
  const file = path.join(motionDir, name)
  if (!fs.existsSync(file)) fail(`Camada ${key} da Windows Beta não foi empacotada no APK.`)
  const bytes = fs.readFileSync(file)
  const blob = gitBlobSha(bytes)
  if (blob !== meta.blobSha) fail(`${key}: Git blob incorreto: ${blob}`)
  if (meta.size && bytes.length !== meta.size) fail(`${key}: tamanho incorreto: ${bytes.length}`)
  if (meta.sha256) {
    const sha = crypto.createHash("sha256").update(bytes).digest("hex")
    if (sha !== meta.sha256) fail(`${key}: SHA-256 incorreto: ${sha}`)
  }
}

const androidPatch = path.join(motionDir, "android-motion-beta.js")
if (!fs.existsSync(androidPatch)) fail("Complemento Motion Android não foi empacotado no APK.")

if (!new RegExp(`applicationId\\s+["']${config.applicationId.replace(/\./g, "\\.")}["']`).test(read(gradle))) fail("applicationId da Beta não foi aplicado.")
if (!read(strings).includes(config.appName)) fail("Nome Santa Luzia Motion Beta não foi aplicado.")

console.log(`[motion-beta] Pacote isolado pronto: ${config.applicationId} ${config.versionName} (code ${config.versionCode}).`)
console.log(`[motion-beta] Stack Windows Beta completa empacotada no commit ${config.windowsBeta.commit}.`)
