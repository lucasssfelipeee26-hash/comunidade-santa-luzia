const fs = require("node:fs")
const path = require("node:path")

const dir = __dirname
const original = path.join(dir, "auditar-beta18-recovery.cjs")
const temp = path.join(dir, ".auditar-beta20-heranca.tmp.cjs")

let source = fs.readFileSync(original, "utf8")
source = source
  .replace('if (beta.versionName !== "2.0.0-beta.18" || beta.versionCode !== 20018) throw new Error(`Beta 18 inválida: ${beta.versionName}/code${beta.versionCode}`)', 'if (beta.versionName !== "2.0.0-beta.21" || beta.versionCode !== 20021) throw new Error(`Beta 21 inválida: ${beta.versionName}/code${beta.versionCode}`)')
  .replace('\'className="object-contain object-center"\'', '\'className="object-cover object-center"\'')
  .replace('\'data-auditor-santa-luzia="beta18"\'', '\'data-auditor-santa-luzia="beta21"\'')
  .replace('"Beta 18 · Auditor + Deep Scan"', '"Beta 21 · Auditor Profundo"')
  .replace('["2.0.0-beta.18", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v4", "CLEAN_VERSION_KEY"]', '["2.0.0-beta.21", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v6", "CLEAN_VERSION_KEY", "route-transition-v2", "blackBox", "applicationExitInfo", "perfettoTraceMarkers"]')
  .replace('console.log("Beta 18 aprovada nas exigências visuais e funcionais:', 'console.log("Herança completa Beta 18 aprovada dentro da Beta 21 com Auditor Profundo:')

try {
  fs.writeFileSync(temp, source)
  require(temp)
} finally {
  fs.rmSync(temp, { force: true })
}
