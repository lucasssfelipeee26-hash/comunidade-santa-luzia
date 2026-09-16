const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const source = beta.windowsBeta

if (!source || !/^[a-f0-9]{40}$/i.test(source.commit || "")) {
  throw new Error("Commit fixado da Windows Beta ausente ou inválido.")
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`)
  return crypto.createHash("sha1").update(header).update(buffer).digest("hex")
}

async function download(key, destinationName) {
  const meta = source.files?.[key]
  if (!meta?.path || !/^[a-f0-9]{40}$/i.test(meta.blobSha || "")) {
    throw new Error(`Metadados inválidos para a camada Windows: ${key}`)
  }
  const url = `https://raw.githubusercontent.com/${source.repository}/${source.commit}/${meta.path}`
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`Falha ao baixar ${key}: HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const blob = gitBlobSha(buffer)
  if (blob !== meta.blobSha) throw new Error(`${key}: Git blob divergente: ${blob}`)
  if (meta.size && buffer.length !== meta.size) throw new Error(`${key}: tamanho divergente: ${buffer.length}`)
  if (meta.sha256) {
    const sha = crypto.createHash("sha256").update(buffer).digest("hex")
    if (sha !== meta.sha256) throw new Error(`${key}: SHA-256 divergente: ${sha}`)
  }
  const target = path.join(root, "android-web", "motion", destinationName)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, buffer)
  console.log(`[motion-beta] ${key} fixado: ${buffer.length} bytes / blob ${blob}`)
}

;(async () => {
  await download("motionCss", "windows-motion-fixes.css")
  await download("behavior", "windows-behavior-fixes.js")
  await download("polish", "windows-beta7-polish.js")
  await download("preload", "windows-preload-v5.js")
  await download("runtime", "windows-beta-runtime.js")
  console.log(`[motion-beta] Stack Windows Beta completa fixada no commit ${source.commit}.`)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
