const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const indexFile = path.join(root, "android-web", "index.html")

if (!fs.existsSync(indexFile)) throw new Error("android-web/index.html ausente; execute build:android-local antes.")

let html = fs.readFileSync(indexFile, "utf8")
const forbidden = [
  "windows-behavior-fixes.js",
  "windows-beta7-polish.js",
  "windows-preload-v5.js",
  "windows-beta-runtime.js",
]

for (const name of forbidden) {
  const before = html
  html = html.replace(new RegExp(`\\s*<script[^>]+src=["']/motion/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*><\\/script>`, "gi"), "")
  if (before === html && html.includes(name)) throw new Error(`Não foi possível remover a execução Android de ${name}.`)
}

// O CSS de referência Windows também não deve governar a UI Android. O visual
// Motion já existe nos componentes e nas camadas Android específicas.
html = html.replace(/\s*<link[^>]+href=["']\/motion\/windows-motion-fixes\.css["'][^>]*\/?\s*>/gi, "")

for (const name of forbidden) if (html.includes(name)) throw new Error(`Stack Windows ainda executável no HTML Android: ${name}`)
if (html.includes("windows-motion-fixes.css")) throw new Error("CSS Windows ainda ativo no HTML Android.")

fs.writeFileSync(indexFile, html)
console.log("[beta17] Stack Windows preservada apenas como referência de build e removida da execução Android.")
