const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function read(relative) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${relative}`)
  return fs.readFileSync(file, "utf8")
}
function requireAll(relative, markers, label) {
  const text = read(relative)
  const missing = markers.filter((marker) => !text.includes(marker))
  if (missing.length) throw new Error(`${label}: faltando ${missing.join(" | ")}`)
  return text
}
function forbid(relative, markers, label) {
  const text = read(relative)
  const found = markers.filter((marker) => text.includes(marker))
  if (found.length) throw new Error(`${label}: proibido ${found.join(" | ")}`)
}

if (beta.versionName !== "2.0.0-beta.17" || beta.versionCode !== 20017) throw new Error(`Beta 17 inválida: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("Pacote Motion Beta alterado")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) throw new Error(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}`)

requireAll("components/mobile-bottom-nav.tsx", [
  'data-motion="home"', "sl-nav-item[data-active=\"true\"]", "@keyframes slNavHome", "translateY(3px) scale(.88)", "label: \"Início\"", "data-bottom-nav-network-stable",
], "Animação original do Início")
forbid("components/mobile-bottom-nav.tsx", ["function animarIcone", "svg.animate(frames"], "Animação substituta")

requireAll("lib/local-first-queue.ts", [
  "type NativeStoreHandle", "return { store: module.OfflineStore }", "handle.store.loadQueue()", "handle.store.saveQueue", "OfflineStore.then()",
], "Fila nativa")
forbid("lib/local-first-queue.ts", ["return OfflineStore\n"], "Proxy thenable direto")

requireAll("android-web/motion/android-auditor-patch-beta16.js", [
  "2.0.0-beta.17", "unique-signatures", "eventSignature", "occurrences", "firstAt", "lastAt", "CLEAN_VERSION_KEY", "santa-luzia-diagnostico-v4", "deleteLastReport", "/api/constancia-luz",
], "Auditor Beta 17")
requireAll("components/diagnostico-santa-luzia.tsx", [
  "data-auditor-santa-luzia=\"beta17\"", "Beta 17 · Auditor + Deep Scan", "contagem por defeitos únicos", "remover o último arquivo de relatório gerado",
], "Tela do Auditor")
requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/DiagnosticReportPlugin.java", [
  "deleteLastReport", "FALHA_REMOVER_RELATORIO", "ultimoRelatorioUri = null", "ultimoRelatorioNome = null",
], "Exclusão do relatório")
requireAll("scripts/sanitize-android-beta17.cjs", [
  "windows-behavior-fixes.js", "windows-beta7-polish.js", "windows-preload-v5.js", "windows-beta-runtime.js", "windows-motion-fixes.css", "removida da execução Android",
], "Saneamento Windows")
requireAll("capacitor.config.ts", ["2.0.0-beta.17", "SantaLuziaOriginalUIOffline/2"], "Identidade nativa")
forbid("capacitor.config.ts", ["SantaLuziaWindowsBeta/"], "User-Agent Windows no Android")

console.log("Beta 17 aprovada na fonte: contagem única, histórico limpo por versão, relatório removível, OfflineStore.then corrigido, stack Windows não executável e animação original do Início restaurada.")
