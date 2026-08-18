const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const raiz = path.resolve(__dirname, "..")
const caminhos = {
  offline: path.join(raiz, "android-web", "offline.html"),
  bridge: path.join(raiz, "android-web", "offline-bridge.html"),
  missao: path.join(raiz, "android-web", "caminho-da-luz", "index.html"),
}

for (const arquivo of Object.values(caminhos)) {
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

const offline = fs.readFileSync(caminhos.offline, "utf8")
const marcadores = [
  ["OfflineStore", "armazenamento nativo local"],
  ["quiz-liturgia", "fila do Quiz da Liturgia"],
  ["function perfis()", "perfis/equipe sincronizados"],
  ["function renderBiblioteca", "Biblioteca local"],
  ['bottomTabs=[["inicio"', "navegação local com Início"],
  ['window.addEventListener("online"', "retorno automático ao servidor"],
]

for (const [marcador, recurso] of marcadores) {
  if (!offline.includes(marcador)) throw new Error(`Núcleo offline sem recurso obrigatório (${recurso}): ${marcador}`)
}

// A Missão do Altar é um pacote local independente. A validação correta é confirmar
// que o HTML do jogo continua fisicamente dentro de android-web; ele não precisa ser
// acoplado por uma frase ou link específico da antiga tela de contingência.
const missao = fs.readFileSync(caminhos.missao, "utf8")
if (!missao.includes("<script") || missao.length < 1000) {
  throw new Error("Pacote local da Missão do Altar parece incompleto.")
}

console.log("Núcleo Android offline validado: HTML/JavaScript válidos, navegação local, dados essenciais e jogo local presentes.")
