const fs = require("node:fs")
const path = require("node:path")

const dir = __dirname
const original = path.join(dir, "auditar-beta18-recovery.cjs")
const temp = path.join(dir, ".auditar-beta19-heranca.tmp.cjs")

let source = fs.readFileSync(original, "utf8")
source = source
  .replace('if (beta.versionName !== "2.0.0-beta.18" || beta.versionCode !== 20018) throw new Error(`Beta 18 inválida: ${beta.versionName}/code${beta.versionCode}`)', 'if (beta.versionName !== "2.0.0-beta.19" || beta.versionCode !== 20019) throw new Error(`Beta 19 inválida: ${beta.versionName}/code${beta.versionCode}`)')
  .replace('\'className="object-contain object-center"\'', '\'className="object-cover object-center"\'')
  .replace('console.log("Beta 18 aprovada nas exigências visuais e funcionais:', 'console.log("Herança completa Beta 18 aprovada dentro da Beta 19:')

try {
  fs.writeFileSync(temp, source)
  require(temp)
} finally {
  fs.rmSync(temp, { force: true })
}
