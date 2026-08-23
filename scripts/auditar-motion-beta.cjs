const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function read(relative) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${relative}`)
  return fs.readFileSync(file, "utf8")
}

function requireText(content, marker, label) {
  if (!content.includes(marker)) throw new Error(`${label}: marcador ausente: ${marker}`)
}

if (stable.versionCode !== 18 || stable.versionName !== "1.0.6") {
  throw new Error(`A Motion Beta não pode alterar o Android estável: encontrado ${stable.versionName}/code${stable.versionCode}.`)
}
if (beta.applicationId === "br.com.comunidadesantaluzia.app") throw new Error("applicationId da Beta colide com o aplicativo oficial.")
if (!/^2\.0\.0-beta\.\d+$/.test(beta.versionName)) throw new Error(`Versionamento Motion Beta inválido: ${beta.versionName}`)
if (!Number.isInteger(beta.versionCode) || beta.versionCode < 20001) throw new Error("versionCode da Motion Beta deve usar faixa isolada >= 20001.")
if (!/^https:\/\//.test(beta.serverUrl)) throw new Error("Servidor de sincronização da Beta deve usar HTTPS.")
if (!/^[a-f0-9]{40}$/i.test(beta.windowsMotion.commit)) throw new Error("Commit fixado do runtime Motion é inválido.")
if (!/^[a-f0-9]{64}$/i.test(beta.windowsMotion.sha256)) throw new Error("SHA-256 fixado do runtime Motion é inválido.")

const capacitor = read("capacitor.config.ts")
requireText(capacitor, "SANTA_LUZIA_MOTION_BETA", "Capacitor")
requireText(capacitor, "SantaLuziaMotionBeta/", "Capacitor")
requireText(capacitor, "SantaLuziaAndroid", "Capacitor")

const mainActivity = read("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java")
for (const marker of [
  beta.applicationId,
  "windows-beta-runtime.js",
  "android-motion-beta.js",
  "setDomStorageEnabled(true)",
  "WebSettings.LOAD_DEFAULT",
  "evaluateJavascript",
]) requireText(mainActivity, marker, "MainActivity Motion")

const patch = read("android-web/motion/android-motion-beta.js")
for (const marker of [
  "Formação mais recente",
  "Histórico anterior",
  "DELAY_SEEN_PREFIX",
  "AQUECER_CACHE_PRIVADO",
  "prefers-reduced-motion",
  "viewerId",
  "latestConfirmed",
]) requireText(patch, marker, "Runtime Motion Android")
if (/raw\.githubusercontent\.com|api\.github\.com\/repos/.test(patch)) throw new Error("Runtime Motion Android não pode baixar código remoto durante a execução.")

const sw = read("public/sw.js")
for (const marker of ["PRIVATE_CACHE", "AQUECER_CACHE_PRIVADO", "/area-restrita/membro", "/area-restrita/moderador", "/formacao", "/area-restrita/ranking"]) {
  requireText(sw, marker, "Service Worker local-first")
}

const snapshot = read("components/android-offline-snapshot-runtime.tsx")
for (const marker of ["OfflineStore", "snapshot", "fila", "formacoes", "ranking", "escalas"]) {
  if (!snapshot.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Snapshot offline sem marcador: ${marker}`)
}

const sync = read("components/server-sync-runtime.tsx")
for (const marker of ["sincronizarRelatosAtrasoPendentes", "sincronizarPresencasFormacaoPendentes", "salvarCacheEscalas", "salvarCacheFormacoes", "networkStatusChange"]) {
  requireText(sync, marker, "Sincronização local-first")
}

console.log("[motion-beta] Auditoria arquitetural aprovada.")
console.log(`[motion-beta] Android estável preservado: ${stable.versionName}/code${stable.versionCode}.`)
console.log(`[motion-beta] Beta isolada: ${beta.versionName}/code${beta.versionCode} — ${beta.applicationId}.`)
console.log("[motion-beta] Motion empacotada, cache da interface original, snapshot SQLite/fila e sincronização validados por marcadores.")
