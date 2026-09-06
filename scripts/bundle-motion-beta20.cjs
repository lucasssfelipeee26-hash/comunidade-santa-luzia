const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const web = path.join(root, "android-web")
const indexFile = path.join(web, "index.html")
const motionDir = path.join(web, "motion")
const outputName = "android-motion-runtime-beta20.js"
const outputFile = path.join(motionDir, outputName)
const blackBoxName = "android-blackbox-beta21.js"

function fail(message) {
  console.error(`[beta20-runtime] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(indexFile)) fail("index.html Android ausente.")
const blackBoxFile = path.join(motionDir, blackBoxName)
if (!fs.existsSync(blackBoxFile) || fs.statSync(blackBoxFile).size < 5000) fail("Caixa-preta Beta 21 ausente ou truncada.")
let html = fs.readFileSync(indexFile, "utf8")
const blackBoxTag = `    <script defer src="/motion/${blackBoxName}"></script>`
if (!html.includes(blackBoxTag)) {
  const nativeFetchTag = '    <script defer src="/motion/android-native-fetch-beta10.js"></script>'
  const localTag = '    <script defer src="/local-app.js"></script>'
  if (html.includes(nativeFetchTag)) html = html.replace(nativeFetchTag, `${nativeFetchTag}\n${blackBoxTag}`)
  else if (html.includes(localTag)) html = html.replace(localTag, `${blackBoxTag}\n${localTag}`)
  else fail("Ponto de inserção da caixa-preta não encontrado.")
}

const re = /\s*<script\s+defer\s+src="\/motion\/([^"]+\.js)"\s*><\/script>/g
const scripts = []
let match
while ((match = re.exec(html))) scripts.push(match[1])

if (scripts.length < 10) fail(`Stack Motion incompleta: somente ${scripts.length} script(s).`)
if (!scripts.includes("android-beta19-regression-fix.js")) fail("Correção visual Beta 19 não entrou na stack.")
if (!scripts.includes("android-motion-beta.js")) fail("Runtime Motion histórico ausente.")
if (!scripts.includes(blackBoxName)) fail("Caixa-preta Beta 21 não entrou na stack.")

const unique = new Set()
const parts = []
for (const name of scripts) {
  if (unique.has(name)) fail(`Script Motion duplicado no HTML: ${name}`)
  unique.add(name)
  const file = path.join(motionDir, name)
  if (!fs.existsSync(file)) fail(`Arquivo Motion ausente: ${name}`)
  const source = fs.readFileSync(file, "utf8")
  if (!source.trim()) fail(`Arquivo Motion vazio: ${name}`)
  if (/document\.currentScript/.test(source)) fail(`Script depende de document.currentScript e não pode ser consolidado: ${name}`)
  parts.push(`\n/* ---- ${name} ---- */\n;${source.trim()}\n;`)
}

const bundle = `"use strict";\n/* Santa Luzia Motion Beta 21 — runtime consolidado com caixa-preta. Ordem histórica preservada. */\n${parts.join("\n")}`
fs.writeFileSync(outputFile, bundle)

const firstIndex = html.search(re)
if (firstIndex < 0) fail("Ponto de inserção da stack Motion não encontrado.")
html = html.replace(re, "")
const tag = `    <script defer src="/motion/${outputName}"></script>`
const localTag = '    <script defer src="/local-app.js"></script>'
if (!html.includes(localTag)) fail("local-app.js não encontrado.")
html = html.replace(localTag, `${tag}\n${localTag}`)
fs.writeFileSync(indexFile, html)

const loadedMotion = [...html.matchAll(/<script\s+defer\s+src="\/motion\/([^"]+\.js)"/g)].map((m) => m[1])
if (loadedMotion.length !== 1 || loadedMotion[0] !== outputName) fail("HTML ainda carrega scripts Motion avulsos.")
if (html.indexOf(`/motion/${outputName}`) > html.indexOf("/local-app.js")) fail("Runtime consolidado deve carregar antes do React local.")

for (const name of scripts) {
  if (name === outputName) continue
  const file = path.join(motionDir, name)
  if (fs.existsSync(file)) fs.rmSync(file, { force: true })
}

console.log(`[beta20-runtime] ${scripts.length} scripts consolidados em ${outputName} (${bundle.length} bytes), incluindo caixa-preta Beta 21.`)
