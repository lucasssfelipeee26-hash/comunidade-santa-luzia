const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const files = {
  index: path.join(root, "android-web", "index.html"),
  app: path.join(root, "android-web", "app.js"),
  quiz: path.join(root, "android-web", "quiz-local.js"),
  css: path.join(root, "android-web", "app.css"),
  mission: path.join(root, "android-web", "caminho-da-luz", "index.html"),
}

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo Android local ausente (${name}): ${path.relative(root, file)}`)
}

const index = fs.readFileSync(files.index, "utf8")
if (!/<!doctype html>/i.test(index)) throw new Error("android-web/index.html inválido.")
for (const marker of ["app.css", "app.js", "quiz-local.js", "Abrindo o aplicativo local"]) {
  if (!index.includes(marker)) throw new Error(`Shell local sem marcador obrigatório: ${marker}`)
}

for (const [label, file] of [["app.js", files.app], ["quiz-local.js", files.quiz]]) {
  const code = fs.readFileSync(file, "utf8")
  new vm.Script(code, { filename: path.relative(root, file) })
  if (/raw\.githubusercontent\.com|api\.github\.com\/repos/.test(code)) {
    throw new Error(`${label} não pode baixar código de execução do GitHub.`)
  }
}

const app = fs.readFileSync(files.app, "utf8")
const appMarkers = [
  'const VERSION = "2.0.0-beta.9"',
  'plugin("OfflineStore")',
  'plugin("SyncHttp")',
  "queueLoad",
  "queueSave",
  "flushQueue",
  "syncNow",
  "loadLocalLiturgia",
  "/offline/liturgia-completa/",
  "renderEscala",
  "renderFormacao",
  "renderJornada",
  "renderLiturgia",
  "renderAtrasos",
  "renderManageScale",
  "renderManageFormation",
  "renderPresencas",
  "presenceAction",
  "reportDelay",
  "openGame",
]
for (const marker of appMarkers) if (!app.includes(marker)) throw new Error(`Aplicativo local sem recurso obrigatório: ${marker}`)
if (/location\.href\s*=\s*["']https?:|window\.location\.assign\(\s*["']https?:/.test(app)) {
  throw new Error("Aplicativo local não pode redirecionar a interface para uma origem web remota.")
}

const quiz = fs.readFileSync(files.quiz, "utf8")
for (const marker of ["local:quizzes", "local:quiz-liturgia", "/api/quizzes/liturgia/offline", "saveQueue"]) {
  if (!quiz.includes(marker)) throw new Error(`Quiz local sem recurso obrigatório: ${marker}`)
}

const css = fs.readFileSync(files.css, "utf8")
for (const marker of ["@keyframes trophy", "@keyframes float3d", ".podium", ".bottom", ".nav-modal"]) {
  if (!css.includes(marker)) throw new Error(`CSS local sem recurso obrigatório: ${marker}`)
}

if (fs.existsSync(path.join(root, "android-web", "offline.html"))) throw new Error("Beta 9 não pode manter uma segunda interface offline.html.")
if (fs.existsSync(path.join(root, "android-web", "offline-bridge.html"))) throw new Error("Beta 9 não pode depender do bridge HTML legado.")

const mission = fs.readFileSync(files.mission, "utf8")
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")

console.log("Android local-first validado: shell, navegação, SQLite/SyncHttp, fila, presença, Atrasos, Liturgia, Ranking, quizzes, animações e jogo local presentes.")
