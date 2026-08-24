const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const required = {
  index: path.join(root, "android-web", "index.html"),
  mission: path.join(root, "android-web", "caminho-da-luz", "index.html"),
  motion10: path.join(root, "android-web", "motion", "android-original-ui-beta10.js"),
  nativeFetch: path.join(root, "android-web", "motion", "android-native-fetch-beta10.js"),
  domain: path.join(root, "android-web", "motion", "android-domain-bridge-beta10.js"),
  quiz: path.join(root, "android-web", "motion", "android-quiz-offline-beta10.js"),
  navigation: path.join(root, "android-web", "motion", "android-local-navigation-beta10.js"),
  report: path.join(root, "android-web", "motion", "android-report-bridge-beta11.js"),
  parity: path.join(root, "android-web", "motion", "android-motion-parity-beta11.js"),
  entry: path.join(root, "android-local", "entry.tsx"),
}
for (const [name, file] of Object.entries(required)) if (!fs.existsSync(file)) throw new Error(`Arquivo Android obrigatório ausente (${name}): ${path.relative(root, file)}`)
for (const forbidden of ["offline.html", "offline-bridge.html"]) if (fs.existsSync(path.join(root, "android-web", forbidden))) throw new Error(`Motion Beta não pode conter interface offline paralela: android-web/${forbidden}`)

const index = fs.readFileSync(required.index, "utf8")
if (!/<!doctype html>/i.test(index) || !index.includes("SANTA LUZIA")) throw new Error("index.html Android inválido.")

const versioned = [
  [required.motion10, "runtime de sincronização", "2.0.0-beta.11"],
  [required.nativeFetch, "ponte de fetch nativa", "2.0.0-beta.10"],
  [required.domain, "regras de domínio", "2.0.0-beta.10"],
  [required.quiz, "Quiz Litúrgico offline", "2.0.0-beta.10"],
  [required.navigation, "navegação local", "2.0.0-beta.10"],
  [required.report, "ponte de relatório", "2.0.0-beta.11"],
  [required.parity, "paridade Motion", "2.0.0-beta.11"],
]
for (const [file, label, version] of versioned) {
  const js = fs.readFileSync(file, "utf8")
  new vm.Script(js, { filename: path.relative(root, file) })
  if (!js.includes(version)) throw new Error(`${label} sem versão ${version}.`)
}

const nativeFetch = fs.readFileSync(required.nativeFetch, "utf8")
for (const marker of ["SyncHttp", "FormData", "bodyBase64", "formDataJson", "/api/", "liturgia-completa"]) if (!nativeFetch.includes(marker)) throw new Error(`Ponte nativa sem marcador: ${marker}`)
const domain = fs.readFileSync(required.domain, "utf8")
for (const marker of ["reportar_atraso", "minha-presenca", "caminho-da-luz", "whatajong", "optimisticAdminQuiz", "optimisticTheme"]) if (!domain.includes(marker)) throw new Error(`Domínio base sem marcador: ${marker}`)
const quiz = fs.readFileSync(required.quiz, "utf8")
for (const marker of ["quiz-liturgia", "OfflineStore", "writeRankingCache", "/api/quizzes/liturgia/responder"]) if (!quiz.includes(marker)) throw new Error(`Quiz offline sem marcador: ${marker}`)
const navigation = fs.readFileSync(required.navigation, "utf8")
for (const marker of ["santa-luzia:local-route", "downloadApi", "history.pushState"]) if (!navigation.includes(marker)) throw new Error(`Navegação local sem marcador: ${marker}`)

const motion11 = fs.readFileSync(required.motion10, "utf8")
for (const marker of ["/api/auth/me", "/api/escalas", "/api/formacoes", "/api/ranking", "/api/membros", "/api/formacoes/presencas/resumo?escopo=me", "physicallyOnline", "warmMemberDetails"]) if (!motion11.includes(marker)) throw new Error(`Runtime de aquecimento sem marcador: ${marker}`)
const report = fs.readFileSync(required.report, "utf8")
for (const marker of ["escopo=me", "patchMyFormation", "patchFormationBatch", "patchAdministrative", "patchDelayModeration", "offline-data"]) if (!report.includes(marker)) throw new Error(`Relatório Beta 11 sem marcador: ${marker}`)
const parity = fs.readFileSync(required.parity, "utf8")
for (const marker of ["sl-b11-live-clock", "Pódio da equipe", "sl-b11-card-trophy", "data-motion-personal-report", "santa-luzia:local-route"]) if (!parity.includes(marker)) throw new Error(`Paridade Motion Beta 11 sem marcador: ${marker}`)

const entry = fs.readFileSync(required.entry, "utf8")
for (const marker of ["MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo", "ModeradorPresencasPage", "GerenciadorRanking", "GerenciadorTema", "MobileBottomNav"]) if (!entry.includes(marker)) throw new Error(`Frontend local sem componente original: ${marker}`)

const mission = fs.readFileSync(required.mission, "utf8")
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")
console.log("Pré-validação Beta 11: UI original offline preservada; relatório pessoal, histórico unificado, Motion de Atrasos/Pódio e runtimes locais presentes.")
