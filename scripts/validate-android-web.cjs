const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const raiz = path.resolve(__dirname, "..")
const arquivos = [
  path.join(raiz, "android-web", "offline.html"),
  path.join(raiz, "android-web", "offline-bridge.html"),
  path.join(raiz, "android-web", "caminho-da-luz", "index.html"),
]

for (const arquivo of arquivos) {
  if (!fs.existsSync(arquivo)) throw new Error(`Arquivo Android ausente: ${path.relative(raiz, arquivo)}`)
  const html = fs.readFileSync(arquivo, "utf8")
  if (!/<!doctype html>/i.test(html)) throw new Error(`HTML inválido: ${path.relative(raiz, arquivo)}`)

  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  scripts.forEach((match, indice) => {
    const codigo = match[1].trim()
    if (!codigo) return
    new vm.Script(codigo, { filename: `${path.relative(raiz, arquivo)}#script-${indice + 1}` })
  })
}

const offline = fs.readFileSync(path.join(raiz, "android-web", "offline.html"), "utf8")
for (const marcador of ["OfflineStore", "quiz-liturgia", "Biblioteca", "Perfis", "caminho-da-luz/index.html"]) {
  if (!offline.includes(marcador)) throw new Error(`Núcleo offline sem recurso obrigatório: ${marcador}`)
}

console.log("Núcleo Android offline validado: HTML presente, JavaScript sintaticamente válido e recursos essenciais referenciados.")
