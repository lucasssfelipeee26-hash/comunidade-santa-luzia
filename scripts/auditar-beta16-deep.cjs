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
  const missing = markers.filter((m) => !text.includes(m))
  if (missing.length) throw new Error(`${label}: faltando ${missing.join(" | ")}`)
  return text
}
function forbid(relative, markers, label) {
  const text = read(relative)
  const found = markers.filter((m) => text.includes(m))
  if (found.length) throw new Error(`${label}: conteúdo proibido ${found.join(" | ")}`)
}

if (beta.versionName !== "2.0.0-beta.16" || beta.versionCode !== 20016) throw new Error(`Beta 16 inválida: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("Pacote Beta alterado")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) throw new Error(`Estável alterado: ${stable.versionName}/code${stable.versionCode}`)

requireAll("components/diagnostico-santa-luzia.tsx", [
  "data-auditor-santa-luzia=\"beta16\"", "data-deep-auditor-ui", "android-deep-auditor-beta16.js", "Deep Scan", "Executar auditoria", "Gerar relatório", "Compartilhar", "Limpar histórico",
], "Tela do Auditor")
forbid("components/diagnostico-santa-luzia.tsx", ["Eventos recentes", "Versão monitorada", "Dados locais", "Banco SQLite", "Tela atual"], "Diagnóstico simplificado")

const deep = requireAll("android-web/motion/android-deep-auditor-beta16.js", [
  "2.0.0-beta.16", "scanIcons", "scanInteractive", "scanImages", "scanLayout", "profile-dialog-collapsed", "profile-dialog-content-missing", "document-horizontal-overflow", "bottom-nav-item-missing", "route-loading-too-long", "sendGlitchTip", "application/x-sentry-envelope", "/api/configuracao/diagnostico", "SantaLuziaDeepAudit",
], "Deep Scan")
if (deep.length < 10000) throw new Error("Deep Scan parece incompleto")

requireAll("android-web/motion/android-auditor-patch-beta16.js", [
  "2.0.0-beta.16", "compactEvents", "local-db-health", "santa-luzia-diagnostico-v3", "deepAudit", "glitchTip", "saveReport", "SantaLuziaAuditor",
], "Patch do relatório")
requireAll("app/api/configuracao/diagnostico/route.ts", ["GLITCHTIP_DSN", "NEXT_PUBLIC_GLITCHTIP_DSN", "Acesso exclusivo do moderador", "deepScan"], "Configuração GlitchTip")

requireAll("components/equipe-no-painel.tsx", ["createPortal", "document.body", "data-profile-viewer-overlay", "data-profile-viewer-banner", "data-profile-close", "data-profile-scroll", "data-profile-photo-frame=\"preserve-ratio\"", "object-contain object-center"], "Perfis sem corte")
requireAll("components/mobile-bottom-nav.tsx", ["animarIcone", "svg.animate", "motion === \"home\"", "data-bottom-nav-network-stable", "label: \"Início\""], "Animação Início")
requireAll("android-local/shims/next-navigation.ts", ["slRouteTransition", "slRouteTransitionSince", "santa-luzia:route-settled", "resetScroll", "requestAnimationFrame"], "Transições locais")

for (const file of ["components/diagnostico-santa-luzia.tsx", "components/equipe-no-painel.tsx", "components/mobile-bottom-nav.tsx"]) {
  forbid(file, ["DoorTransitionScene", "ProfileDoorIcon", "data-door-scene"], "Animação cancelada")
}

console.log("Beta 16 fonte aprovada: Deep Scan + ponte GlitchTip, diagnóstico simplificado, perfil em portal, Início animado e transições estabilizadas; estável 1.0.6/code18 preservado.")
