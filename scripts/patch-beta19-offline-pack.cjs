const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

const root = path.resolve(__dirname, "..")
const dir = path.join(root, "android-web", "offline", "iliturgia")
const manifestFile = path.join(dir, "manifest.json")
const config = require(path.join(root, "config", "android-motion-beta.json"))

function fail(message) {
  console.error(`[beta20-offline] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(manifestFile)) fail("Manifesto do acervo não foi gerado.")
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"))
if (!manifest?.offline || !manifest?.embedded) fail("Manifesto não está marcado como offline/embutido.")
if (!Array.isArray(manifest.categorias) || manifest.categorias.length < 8) fail("Categorias do acervo incompletas.")

const convertidos = new Map()
for (const categoria of manifest.categorias) {
  if (!Array.isArray(categoria.arquivos) || !categoria.arquivos.length) fail(`Categoria sem pacote: ${categoria.id}`)
  categoria.arquivos = categoria.arquivos.map((nome) => {
    const original = path.join(dir, nome)
    if (!fs.existsSync(original)) fail(`Pacote original ausente: ${nome}`)
    if (!nome.toLowerCase().endsWith(".gz")) return nome

    let destinoNome = convertidos.get(nome)
    if (!destinoNome) {
      destinoNome = nome.replace(/\.gz$/i, ".bin")
      const destino = path.join(dir, destinoNome)
      const bytes = fs.readFileSync(original)
      try {
        const aberto = zlib.gunzipSync(bytes)
        if (aberto.length < 10) fail(`Pacote vazio após descompactação: ${nome}`)
        const parsed = JSON.parse(aberto.toString("utf8"))
        if (!Array.isArray(parsed?.documents) || !parsed.documents.length) fail(`Pacote sem documentos: ${nome}`)
      } catch (error) {
        fail(`Pacote GZIP inválido ${nome}: ${error instanceof Error ? error.message : String(error)}`)
      }
      fs.copyFileSync(original, destino)
      if (!fs.existsSync(destino) || fs.statSync(destino).size !== bytes.length) fail(`Falha ao criar pacote Android: ${destinoNome}`)
      convertidos.set(nome, destinoNome)
    }
    return destinoNome
  })
}

manifest.androidAssetTransport = "binary-v1"
manifest.androidAssetExtension = ".bin"
manifest.beta = config.versionName
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

const arquivos = [...convertidos.values()]
if (arquivos.length < 10) fail(`Poucos pacotes offline convertidos (${arquivos.length}).`)
for (const exigido of ["oficio-01.html.json.bin", "oficio-10.html.json.bin", "lecionario.html.json.bin", "missal.html.json.bin", "gerais.html.json.bin"]) {
  if (!fs.existsSync(path.join(dir, exigido))) fail(`Pacote crítico Android ausente: ${exigido}`)
}

console.log(`[beta20-offline] ${arquivos.length} pacote(s) litúrgico(s) validados e preparados como assets binários locais (${config.versionName}).`)
