const crypto = require("node:crypto")
const fs = require("node:fs")
const https = require("node:https")
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

function origemGitHubPermitida(url) {
  if (url.protocol !== "https:") return false
  return url.hostname === "github.com" || url.hostname.endsWith(".githubusercontent.com")
}

function baixarArquivo(url, arquivo, redirecionamentos = 0) {
  return new Promise((resolve, reject) => {
    if (!origemGitHubPermitida(url)) {
      reject(new Error(`Origem não autorizada para o APK Android: ${url.hostname}`))
      return
    }
    if (redirecionamentos > 6) {
      reject(new Error("O download do APK Android excedeu o limite de redirecionamentos."))
      return
    }

    const requisicao = https.get(url, {
      headers: {
        Accept: "application/vnd.android.package-archive, application/octet-stream",
        "User-Agent": "SantaLuzia-Build/1",
      },
      timeout: 30_000,
    }, (resposta) => {
      if (resposta.statusCode >= 300 && resposta.statusCode < 400 && resposta.headers.location) {
        resposta.resume()
        const proxima = new URL(resposta.headers.location, url)
        baixarArquivo(proxima, arquivo, redirecionamentos + 1).then(resolve, reject)
        return
      }

      if (resposta.statusCode < 200 || resposta.statusCode >= 300) {
        resposta.resume()
        reject(new Error(`Falha ao baixar o APK Android do GitHub (HTTP ${resposta.statusCode}).`))
        return
      }

      const saida = fs.createWriteStream(arquivo, { flags: "w" })
      resposta.pipe(saida)
      saida.on("finish", () => saida.close(resolve))
      saida.on("error", (erro) => {
        resposta.destroy()
        reject(erro)
      })
    })

    requisicao.on("timeout", () => requisicao.destroy(new Error("Tempo esgotado ao baixar o APK Android.")))
    requisicao.on("error", reject)
  })
}

function materializarPartes() {
  const partes = fs.readdirSync(partesDir).filter((nome) => /^part-\d+$/.test(nome)).sort()
  if (partes.length !== release.parts) throw new Error(`Quantidade inválida de partes do APK: ${partes.length}.`)

  const saida = fs.openSync(temporario, "w")
  try {
    for (const parte of partes) fs.writeSync(saida, fs.readFileSync(path.join(partesDir, parte)))
  } finally {
    fs.closeSync(saida)
  }
}

async function materializarGitHubRelease() {
  if (!release.releaseTag || !release.releaseAsset) {
    throw new Error("O release Android não possui origem GitHub válida.")
  }

  const tag = encodeURIComponent(release.releaseTag)
  const asset = encodeURIComponent(release.releaseAsset)
  const url = new URL(`https://github.com/lucasssfelipeee26-hash/comunidade-santa-luzia/releases/download/${tag}/${asset}`)

  let ultimoErro
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      fs.rmSync(temporario, { force: true })
      await baixarArquivo(url, temporario)
      return
    } catch (erro) {
      ultimoErro = erro
      if (tentativa < 3) await new Promise((resolve) => setTimeout(resolve, tentativa * 1_000))
    }
  }
  throw ultimoErro
}

async function main() {
  fs.mkdirSync(downloadsDir, { recursive: true })
  fs.rmSync(temporario, { force: true })

  if (release.source === "github-release") await materializarGitHubRelease()
  else materializarPartes()

  const arquivo = fs.readFileSync(temporario)
  const sha256 = crypto.createHash("sha256").update(arquivo).digest("hex")
  if (arquivo.length !== release.size || sha256 !== release.sha256) {
    fs.rmSync(temporario, { force: true })
    throw new Error("Falha de integridade ao reconstruir o APK Android.")
  }

  fs.rmSync(destino, { force: true })
  fs.renameSync(temporario, destino)
  console.log(`APK Android materializado: ${release.fileName} (${arquivo.length} bytes, SHA-256 ${sha256}).`)
}

main().catch((erro) => {
  fs.rmSync(temporario, { force: true })
  console.error(erro)
  process.exit(1)
})
