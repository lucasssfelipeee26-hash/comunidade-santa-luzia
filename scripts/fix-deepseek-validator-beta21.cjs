const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const file = path.join(root, "scripts", "build-android-local.cjs")
let source = fs.readFileSync(file, "utf8")

const stale = '  "android-db-health-beta12.js", "android-performance-beta12.js", "android-scroll-stability-beta12.js", "android-podium-beta12.js", "/local-app.js",'
const fixed = '  "android-db-health-beta12.js", "android-performance-beta12.js", "android-scroll-stability-beta12.js", "/local-app.js",'

if (source.includes(stale)) {
  source = source.replace(stale, fixed)
  fs.writeFileSync(file, source)
  console.log("[beta21-validator] exigência antiga de android-podium-beta12.js removida do validador HTML.")
} else if (!source.includes('"android-podium-beta12.js", "/local-app.js"')) {
  console.log("[beta21-validator] validador já está alinhado ao pódio React.")
} else {
  throw new Error("Não foi possível localizar com segurança a trava antiga do pódio.")
}
