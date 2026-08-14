const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
const android = path.join(raiz, "android")
const appGradle = path.join(android, "app", "build.gradle")
const variablesGradle = path.join(android, "variables.gradle")
const origemSons = path.join(raiz, "native-assets", "android", "res", "raw")
const destinoSons = path.join(android, "app", "src", "main", "res", "raw")

if (!fs.existsSync(appGradle)) throw new Error("Projeto Android ausente. Execute npm run android:add primeiro.")

const versionCode = Number(process.env.APP_VERSION_CODE || 1)
const versionName = String(process.env.APP_VERSION_NAME || require("../package.json").version)
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("APP_VERSION_CODE deve ser um inteiro positivo.")

let app = fs.readFileSync(appGradle, "utf8")
app = app.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
app = app.replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`)
fs.writeFileSync(appGradle, app)

if (fs.existsSync(variablesGradle)) {
  let variables = fs.readFileSync(variablesGradle, "utf8")
  variables = variables.replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  variables = variables.replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36")
  fs.writeFileSync(variablesGradle, variables)
}

fs.mkdirSync(destinoSons, { recursive: true })
for (const arquivo of fs.readdirSync(origemSons)) {
  if (arquivo.endsWith(".wav")) fs.copyFileSync(path.join(origemSons, arquivo), path.join(destinoSons, arquivo))
}

console.log(`Android preparado: versionCode ${versionCode}, versionName ${versionName}, targetSdk 36.`)
