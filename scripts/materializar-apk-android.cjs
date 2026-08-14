const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
const release = require(path.join(raiz, "native-assets", "android", "release", "manifest.json"))
const configuracao = require(path.join(raiz, "config", "android-release.json"))
const partesDir = path.join(raiz, "native-assets", "android", "release", "parts")
const downloadsDir = path.join(raiz, "public", "downloads")
const destino = path.join(downloadsDir, release.fileName)
const temporario = `${destino}.tmp`

if (release.versionCode !== configuracao.versionCode || release.versionName !== configuracao.versionName) {
  throw new Error("O APK empacotado não corresponde à versão configurada para o Android.")
}

const partes = fs.readdirSync(partesDir).filter((nome) => /^part-\d+$/.test(nome)).sort()
if (partes.length !== release.parts) throw new Error(`Quantidade inválida de partes do APK: ${partes.length}.`)

fs.mkdirSync(downloadsDir, { recursive: true })
const saida = fs.openSync(temporario, "w")
try {
  for (const parte of partes) fs.writeSync(saida, fs.readFileSync(path.join(partesDir, parte)))
} finally {
  fs.closeSync(saida)
}

const arquivo = fs.readFileSync(temporario)
const sha256 = crypto.createHash("sha256").update(arquivo).digest("hex")
if (arquivo.length !== release.size || sha256 !== release.sha256) {
  fs.rmSync(temporario, { force: true })
  throw new Error("Falha de integridade ao reconstruir o APK Android.")
}

fs.renameSync(temporario, destino)
console.log(`APK Android materializado: ${release.fileName} (${arquivo.length} bytes, SHA-256 ${sha256}).`)
