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
function all(relative, markers, label) {
  const text = read(relative)
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label}: marcador ausente em ${relative}: ${marker}`)
  return text
}

if (stable.versionCode !== 18 || stable.versionName !== "1.0.6") throw new Error(`Android estável alterado: ${stable.versionName}/code${stable.versionCode}`)
if (beta.applicationId === "br.com.comunidadesantaluzia.app") throw new Error("Pacote Beta colide com o oficial.")
if (beta.versionName !== "2.0.0-beta.9" || beta.versionCode !== 20009) throw new Error(`Beta 9 esperada; encontrado ${beta.versionName}/code${beta.versionCode}.`)
if (!/^https:\/\//.test(beta.serverUrl)) throw new Error("Servidor de sincronização deve usar HTTPS.")

const capacitor = all("capacitor.config.ts", [
  'motionVersion = String(process.env.SANTA_LUZIA_MOTION_VERSION || "2.0.0-beta.9")',
  "if (!motionBeta && valorServidor)",
  "SantaLuziaLocalFirst/1",
  'webDir: "android-web"',
], "Capacitor local-first")
if (/errorPath|offline\.html/.test(capacitor)) throw new Error("Beta 9 não pode ter interface offline alternativa.")

all("android-web/index.html", ["app.css", "app.js", "quiz-local.js", "Abrindo o aplicativo local"], "Shell HTML local")
all("android-web/app.css", ["@keyframes trophy", "@keyframes float3d", ".podium", ".nav-modal", ".bottom"], "Animações/visual local")
const app = all("android-web/app.js", [
  'const VERSION = "2.0.0-beta.9"',
  'session: "local:session"',
  'escalas: "local:escalas"',
  'formacoes: "local:formacoes"',
  'ranking: "local:ranking"',
  'plugin("OfflineStore")',
  'plugin("SyncHttp")',
  "queueLoad",
  "queueSave",
  "flushQueue",
  "syncNow",
  "loadLocalLiturgia",
  "/offline/liturgia-completa/",
  "presenceAction",
  "/minha-presenca",
  "reportDelay",
  'action:"reportar_atraso"',
  "moderateDelay",
  "renderEscala",
  "renderFormacao",
  "renderJornada",
  "renderLiturgia",
  "renderAtrasos",
  "renderManageScale",
  "renderManageFormation",
  "renderPresencas",
  "renderRegistro",
  "openGame",
  'plugin("CaminhoDaLuz")',
  'plugin("Whatajong")',
], "Aplicativo SPA local")
if (/window\.location\.assign\(|location\.href\s*=\s*["']https?:/.test(app)) throw new Error("Shell local não pode navegar para uma interface web remota.")

all("android-web/quiz-local.js", ["local:quizzes", "local:quiz-liturgia", "/api/quizzes/liturgia/offline", "saveQueue"], "Quiz offline")

const main = all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java", [
  beta.applicationId,
  "registerPlugin(OfflineStorePlugin.class)",
  "registerPlugin(SyncHttpPlugin.class)",
  "registerPlugin(CaminhoDaLuzPlugin.class)",
  "registerPlugin(WhatajongPlugin.class)",
  "setDomStorageEnabled(true)",
], "MainActivity local")
if (/evaluateJavascript|android-offline-first-beta7|android-local-first-beta8|windows-beta-runtime/.test(main)) throw new Error("Beta 9 não pode depender da injeção do site remoto.")

all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/SyncHttpPlugin.java", [
  "https://comunidade-santa-luzia-production.up.railway.app",
  "CookieManager",
  "HttpURLConnection",
  "SantaLuziaLocalFirst/1",
  "/api/formacoes",
  "application/x-www-form-urlencoded",
  "/api/jogo/whatajong/resultado",
  "completedRound",
  "difficulty",
], "Ponte HTTPS de sincronização")

all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/OfflineStorePlugin.java", [
  "SQLiteOpenHelper",
  "santa_luzia_local.db",
  "saveDocument",
  "loadDocument",
  "saveQueue",
  "loadQueue",
  "fallbackBeta8",
  "normalizarFilaBeta8",
  '"local:session"',
  '"snapshot:ranking"',
  '"snapshot:formacoes"',
  '"snapshot:escalas"',
  '"quiz-liturgia"',
], "SQLite e migração Beta 8")

all("scripts/prepare-android.cjs", ["liturgia-completa", "build-whatajong-original.cjs", "CaminhoDaLuzActivity", "WhatajongActivity"], "Empacotamento offline nativo")
all("app/api/quizzes/liturgia/offline/route.ts", ["dataIso", "respostas", "garantirQuizLiturgiaOffline", "Quiz offline sincronizado"], "API idempotente do Quiz offline")
all("app/api/formacoes/[id]/minha-presenca/route.ts", ["situacao", "justificada", "presente", "horario"], "Regra de presença")
all("app/api/formacoes/[id]/presencas/route.ts", ["presencas", "usuarioId", "situacao", 'method' in {} ? "" : "salvarPresencasFormacao"].filter(Boolean), "Lista de presença")

console.log("[motion-beta] Beta 9 aprovada: APK inicia pelo shell local e usa o servidor somente para sincronização.")
console.log(`[motion-beta] Android oficial preservado: ${stable.versionName}/code${stable.versionCode}.`)
console.log(`[motion-beta] Pacote Beta: ${beta.versionName}/code${beta.versionCode} — ${beta.applicationId}.`)
