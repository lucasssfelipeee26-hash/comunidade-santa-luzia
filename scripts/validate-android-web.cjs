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
  constancia: path.join(root, "android-web", "motion", "android-constancia-luz-beta11.js"),
  report: path.join(root, "android-web", "motion", "android-report-bridge-beta11.js"),
  parity: path.join(root, "android-web", "motion", "android-motion-parity-beta11.js"),
  auditor: path.join(root, "android-web", "motion", "android-auditor-beta12.js"),
  performance: path.join(root, "android-web", "motion", "android-performance-beta12.js"),
  podium: path.join(root, "android-web", "motion", "android-podium-beta12.js"),
  entry: path.join(root, "android-local", "entry.tsx"),
  scales: path.join(root, "components", "escala-publica.tsx"),
  diagnostics: path.join(root, "components", "diagnostico-santa-luzia.tsx"),
  protection: path.join(root, "lib", "data-protection.ts"),
  instrumentation: path.join(root, "instrumentation.ts"),
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
  [required.constancia, "Constância de Luz", "2.0.0-beta.11"],
  [required.report, "ponte de relatório", "2.0.0-beta.11"],
  [required.parity, "compatibilidade Motion Android", "2.0.0-beta.12"],
  [required.auditor, "Auditor Santa Luzia", "2.0.0-beta.12"],
  [required.performance, "performance Android", "2.0.0-beta.12"],
  [required.podium, "pódio atual", "2.0.0-beta.12"],
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

const parity = fs.readFileSync(required.parity, "utf8")
for (const marker of ["motionClockCompatibilityBeta12", "sl-b11-live-clock", ".sl-b11-card-trophy", "santa-luzia:local-route"]) if (!parity.includes(marker)) throw new Error(`Compatibilidade Android sem marcador: ${marker}`)
if (parity.includes("function trophyMarkup") || parity.includes("slB11CupFloat")) throw new Error("A camada de compatibilidade ainda desenha o troféu Beta 11 antigo.")

const podium = fs.readFileSync(required.podium, "utf8")
for (const marker of [".sl-r5-card-trophy", "viewBox=\"0 0 64 64\"", "sl-b11-card-trophy", "fixPodium", "Pódio da equipe"]) {
  if (!podium.includes(marker) && marker !== "fixPodium") throw new Error(`Pódio Beta 12 sem marcador: ${marker}`)
}
if (!podium.includes("normalizeCard") || !podium.includes("valid.slice(1)")) throw new Error("Pódio Beta 12 não garante troféu único.")

const perf = fs.readFileSync(required.performance, "utf8")
for (const marker of ["scroll-behavior:auto", "overflow-anchor:none", "duration:180", "slMotionPerformance", "fps", "sl-b7-route-shield"]) if (!perf.includes(marker)) throw new Error(`Performance Beta 12 sem marcador: ${marker}`)
const auditor = fs.readFileSync(required.auditor, "utf8")
for (const marker of ["SantaLuziaAuditor", "unhandledrejection", "route-transition", "fps-sample", "scroll-jump", "missing-icons", "offline-functional-audit", "exportReport", "Santa-Luzia-Diagnostico-"]) if (!auditor.includes(marker)) throw new Error(`Auditor Beta 12 sem marcador: ${marker}`)
for (const forbidden of ["document.cookie", "authorization:", "localStorage.getItem(\"token\""] ) if (auditor.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Auditor coleta dado sensível proibido: ${forbidden}`)

const scales = fs.readFileSync(required.scales, "utf8")
for (const marker of ["data-escala-history-enabled", "Histórico", "data-escala-historico", "escala.data < hoje", "carregarCacheEscalas", "salvarCacheEscalas"]) if (!scales.includes(marker)) throw new Error(`Histórico de escalas sem marcador: ${marker}`)
const diagnostics = fs.readFileSync(required.diagnostics, "utf8")
for (const marker of ["Auditor Santa Luzia", "Executar auditoria agora", "Gerar relatório técnico", "SantaLuziaAuditor"]) if (!diagnostics.includes(marker)) throw new Error(`Tela de diagnóstico sem marcador: ${marker}`)
const protection = fs.readFileSync(required.protection, "utf8")
for (const marker of ["backups-santa-luzia", "MAX_BACKUPS = 8", "fs.fsyncSync", "recoverIfNeeded", "createBackup", "database-health.json"]) if (!protection.includes(marker)) throw new Error(`Proteção de dados sem marcador: ${marker}`)
if (!fs.readFileSync(required.instrumentation, "utf8").includes("iniciarProtecaoDadosSantaLuzia")) throw new Error("Proteção do banco não é iniciada pelo servidor.")

const entry = fs.readFileSync(required.entry, "utf8")
for (const marker of ["MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo", "ModeradorPresencasPage", "GerenciadorRanking", "GerenciadorTema", "DiagnosticoSantaLuzia", "/area-restrita/moderador/diagnostico", "MobileBottomNav"]) if (!entry.includes(marker)) throw new Error(`Frontend local sem componente/rota: ${marker}`)

const mission = fs.readFileSync(required.mission, "utf8")
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")
console.log("Pré-validação Beta 12: interface original offline, histórico de escalas, Auditor Santa Luzia, proteção de dados, performance/rolagem e pódio atual presentes.")
