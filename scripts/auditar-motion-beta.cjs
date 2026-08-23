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
function requireAll(relative, markers, label) {
  const text = read(relative)
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label}: marcador ausente em ${relative}: ${marker}`)
  return text
}

if (stable.versionCode !== 18 || stable.versionName !== "1.0.6") throw new Error(`Android estável alterado: ${stable.versionName}/code${stable.versionCode}`)
if (beta.versionName !== "2.0.0-beta.10" || beta.versionCode !== 20010) throw new Error(`Beta 10/code20010 esperada: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("Pacote Beta incorreto.")
if (!/^https:\/\//.test(beta.serverUrl)) throw new Error("Servidor de sincronização deve usar HTTPS.")

const capacitor = requireAll("capacitor.config.ts", [
  '2.0.0-beta.10',
  "url: url.origin",
  "allowNavigation: [url.hostname]",
  "SantaLuziaOriginalUIOffline/1",
], "Capacitor")
if (/errorPath|offline\.html/.test(capacitor)) throw new Error("Capacitor não pode apontar para interface offline alternativa.")

requireAll("app/layout.tsx", ["globals.css", "mobile-fixes.css", "MobileBottomNav", "AppRuntime", "OfflineLiturgiaRuntime"], "Interface React original")
requireAll("components/area-menu.tsx", ["Presenças", "Registro", "data-sl-nav-motion"], "Menu original")
requireAll("components/ranking-interativo.tsx", ["Jornada Litúrgica", "Quiz", "Ranking", "CaminhoDaLuzEntry"], "Jornada original")
requireAll("components/formacao-membros.tsx", ["Formação mais recente", "MinhaPresencaControle", "salvarCacheFormacoes"], "Formação original")
requireAll("components/escala-publica.tsx", ["salvarCacheEscalas", "Justificar falta", "Celebração litúrgica"], "Escala original")

requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MotionOfflineWebViewClient.java", [
  "extends BridgeWebViewClient",
  "motion_original_http_cache_v1",
  "shouldInterceptRequest",
  "Next-Router-State-Tree",
  "text/x-component",
  "CookieManager",
  "HttpURLConnection",
  "MAX_CACHE_BYTES",
], "Cache HTTP nativo")

const main = requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java", [
  "MotionOfflineWebViewClient",
  "ServiceWorkerController",
  "android-original-ui-beta10.js",
  "windows-motion-fixes.css",
  "windows-beta-runtime.js",
  "android-local-first-beta8.js",
  "android-member-state-beta8.js",
  "android-rsc-guard-beta8.js",
], "MainActivity híbrida")
if (/offline\.html|offline-bridge\.html/.test(main)) throw new Error("MainActivity não pode referenciar interface offline paralela.")

requireAll("android-web/motion/android-original-ui-beta10.js", [
  'const VERSION = "2.0.0-beta.10"',
  "PUBLIC_ROUTES",
  "MEMBER_ROUTES",
  "MODERATOR_ROUTES",
  "COMMON_APIS",
  "MODERATOR_APIS",
  "physicallyOnline",
  "fullWarm",
  "recoverAuthenticatedOfflineRoute",
  "/api/auth/me",
], "Runtime original Beta 10")

requireAll("android-web/motion/android-local-first-beta8.js", [
  "queueEligible",
  "createQueuedMutation",
  "optimisticMutation",
  "replayQueue",
  "/api/escalas",
  "/api/formacoes",
  "/api/perfil",
], "Fila transacional")
requireAll("android-web/motion/android-member-state-beta8.js", ["/status", "/promover", "/registros", "offline_pendente"], "Estado local de membros")
requireAll("android-web/motion/android-rsc-guard-beta8.js", ["text/x-component", "next-router-state-tree", "restoreDocument"], "Isolamento RSC")

for (const forbidden of ["android-web/offline.html", "android-web/offline-bridge.html"]) {
  if (fs.existsSync(path.join(root, forbidden))) throw new Error(`Interface paralela proibida ainda existe: ${forbidden}`)
}

console.log("[motion-beta] Beta 10 aprovada: mesma interface React online/offline; servidor apenas sincroniza dados após o primeiro login.")
console.log(`[motion-beta] Android oficial preservado: ${stable.versionName}/code${stable.versionCode}.`)
