const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const file = path.join(root, "android-web", "motion", "windows-beta7-polish.js")
if (!fs.existsSync(file)) throw new Error("windows-beta7-polish.js ausente; execute fetch-windows-beta-stack antes.")

let source = fs.readFileSync(file, "utf8")
const broken = 'window.addEventListener("resize", () => updateBottomNav());'
const fixed = 'window.addEventListener("resize", () => restoreAndroidBottomNav());'

if (source.includes(broken)) source = source.replace(broken, fixed)
else if (!source.includes(fixed)) throw new Error("Assinatura esperada do resize não encontrada; não vou alterar a camada visual às cegas.")

if (/\bupdateBottomNav\s*\(/.test(source)) throw new Error("Referência updateBottomNav ainda executável após correção.")
if (!source.includes("restoreAndroidBottomNav()")) throw new Error("restoreAndroidBottomNav ausente após correção.")

fs.writeFileSync(file, source)
console.log("[beta18] Corrigida apenas a chamada resize inválida; runtime visual, barra e animações originais foram preservados.")
