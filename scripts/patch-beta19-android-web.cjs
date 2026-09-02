const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const index = path.join(root, "android-web", "index.html")
const patch = path.join(root, "android-web", "motion", "android-beta19-regression-fix.js")

function fail(message) {
  console.error(`[beta19-web] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(index)) fail("index.html Android ausente.")
if (!fs.existsSync(patch) || fs.statSync(patch).size < 500) fail("Patch visual Beta 19 ausente ou truncado.")

let html = fs.readFileSync(index, "utf8")
const tag = '    <script defer src="/motion/android-beta19-regression-fix.js"></script>'
if (!html.includes(tag)) {
  const alvo = '    <script defer src="/local-app.js"></script>'
  if (!html.includes(alvo)) fail("Ponto de entrada local-app.js não encontrado.")
  html = html.replace(alvo, `${tag}\n${alvo}`)
}
fs.writeFileSync(index, html)

const posRuntime = html.indexOf('/motion/android-motion-beta.js')
const posPatch = html.indexOf('/motion/android-beta19-regression-fix.js')
const posApp = html.indexOf('/local-app.js')
if (posRuntime < 0 || posPatch < 0 || posApp < 0 || !(posRuntime < posPatch && posPatch < posApp)) {
  fail("Ordem dos runtimes Android incorreta.")
}
console.log("[beta19-web] Patch de regressão carregado depois do runtime histórico e antes do React local.")
