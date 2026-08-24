const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const required = {
  index: path.join(root, "android-web", "index.html"),
  mission: path.join(root, "android-web", "caminho-da-luz", "index.html"),
  motion10: path.join(root, "android-web", "motion", "android-original-ui-beta10.js"),
  nativeFetch: path.join(root, "android-web", "motion", "android-native-fetch-beta10.js"),
  entry: path.join(root, "android-local", "entry.tsx"),
}
for (const [name, file] of Object.entries(required)) if (!fs.existsSync(file)) throw new Error(`Arquivo Android obrigatório ausente (${name}): ${path.relative(root, file)}`)
for (const forbidden of ["offline.html", "offline-bridge.html"]) if (fs.existsSync(path.join(root, "android-web", forbidden))) throw new Error(`Beta 10 não pode conter interface offline paralela: android-web/${forbidden}`)

const index = fs.readFileSync(required.index, "utf8")
if (!/<!doctype html>/i.test(index) || !index.includes("SANTA LUZIA")) throw new Error("index.html Android inválido.")

for (const [file, label] of [[required.motion10, "runtime de sincronização"], [required.nativeFetch, "ponte de fetch nativa"]]) {
  const js = fs.readFileSync(file, "utf8")
  new vm.Script(js, { filename: path.relative(root, file) })
  if (!js.includes('2.0.0-beta.10')) throw new Error(`${label} sem versão Beta 10.`)
}

const nativeFetch = fs.readFileSync(required.nativeFetch, "utf8")
for (const marker of ["SyncHttp", "FormData", "bodyBase64", "formDataJson", "/api/"]) if (!nativeFetch.includes(marker)) throw new Error(`Ponte nativa sem marcador: ${marker}`)

const motion10 = fs.readFileSync(required.motion10, "utf8")
for (const marker of ["/api/auth/me", "/api/escalas", "/api/formacoes", "/api/ranking", "/api/membros", "physicallyOnline", "warmMemberDetails"]) if (!motion10.includes(marker)) throw new Error(`Runtime Beta 10 sem marcador: ${marker}`)

const entry = fs.readFileSync(required.entry, "utf8")
for (const marker of ["MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo", "ModeradorPresencasPage", "GerenciadorRanking", "GerenciadorTema", "MobileBottomNav"]) if (!entry.includes(marker)) throw new Error(`Frontend local sem componente original: ${marker}`)

const mission = fs.readFileSync(required.mission, "utf8")
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")
console.log("Pré-validação Beta 10: frontend original, ponte SyncHttp, dados locais e jogos presentes; nenhuma segunda interface offline.")
