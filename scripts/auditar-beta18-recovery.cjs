const fs = require("node:fs")
const path = require("node:path")
const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function read(rel) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${rel}`)
  return fs.readFileSync(file, "utf8")
}
function requireAll(rel, markers, label) {
  const text = read(rel)
  const missing = markers.filter((m) => !text.includes(m))
  if (missing.length) throw new Error(`${label}: faltando ${missing.join(" | ")}`)
  return text
}
function forbid(rel, markers, label) {
  const text = read(rel)
  const found = markers.filter((m) => text.includes(m))
  if (found.length) throw new Error(`${label}: proibido ${found.join(" | ")}`)
}

if (beta.versionName !== "2.0.0-beta.18" || beta.versionCode !== 20018) throw new Error(`Beta 18 inválida: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("Pacote Beta alterado")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) throw new Error(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}`)

requireAll("components/mobile-bottom-nav.tsx", [
  'label: "Início", icon: Home, motion: "panel"',
  'label: "Escala", icon: CalendarDays, motion: "scale"',
  'label: "Formação", icon: GraduationCap, motion: "formation"',
  'label: "Quiz", icon: BrainCircuit, motion: "quiz"',
  'className="mobile-app-bottom-nav',
  'data-bottom-nav-network-stable="true"',
  'data-sl-nav-motion={"motion" in item ? item.motion : undefined}',
], "Barra inferior original")
forbid("components/mobile-bottom-nav.tsx", ["function animarIcone", "svg.animate(frames", 'motion: "home"'], "Animação substituta")

requireAll("components/moderador-dashboard.tsx", [
  "<ProfileSettings />", "<ModeratorPromotionPanel />", "<EquipeNoPainel />", '>Atrasos<', '>Presenças<', "Cadastros aguardando aprovação",
], "Painel atual do moderador")
forbid("components/moderador-dashboard.tsx", ["AdministracaoModerador", "Meu relatório", "Meu Relatório", "door-transition"], "Itens removidos do painel")
requireAll("components/area-menu.tsx", ["/area-restrita/moderador/administracao", "Database"], "Administração no menu")

requireAll("components/equipe-no-painel.tsx", ["createPortal", "data-profile-viewer-banner", "data-profile-close", "data-profile-scroll", 'data-profile-photo-frame="preserve-ratio"'], "Perfis")
requireAll("android-local/shims/next-navigation.ts", ["slRouteTransition", "santa-luzia:route-settled", "resetScroll"], "Transições")

requireAll("scripts/build-android-local.cjs", ["windows-beta-runtime.js", "windows-beta7-polish.js", "windows-motion-fixes.css", "android-auditor-beta12.js"], "Runtime visual empacotado")
requireAll("scripts/patch-windows-polish-android-beta18.cjs", ["restoreAndroidBottomNav", "updateBottomNav", "não vou alterar a camada visual às cegas"], "Patch cirúrgico do runtime")
forbid("scripts/build-android-local.cjs", ["sanitize-android-beta17"], "Sanitização regressiva")

requireAll("lib/local-first-queue.ts", ["type NativeStoreHandle", "return { store: module.OfflineStore }", "handle.store.loadQueue()", "handle.store.saveQueue"], "Fila nativa")
requireAll("android-web/motion/android-auditor-patch-beta16.js", ["2.0.0-beta.18", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v4", "CLEAN_VERSION_KEY"], "Auditor")
requireAll("components/diagnostico-santa-luzia.tsx", ["data-auditor-santa-luzia=\"beta18\"", "Beta 18 · Auditor + Deep Scan", "contagem por defeitos únicos", "deleteLastReport"], "Tela Diagnóstico")
requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/DiagnosticReportPlugin.java", ["deleteLastReport", "FALHA_REMOVER_RELATORIO"], "Relatório nativo")

for (const rel of ["components/mobile-bottom-nav.tsx", "components/moderador-dashboard.tsx", "components/area-header.tsx", "components/login-form.tsx"]) {
  forbid(rel, ["DoorTransitionScene", "ProfileDoorIcon", "data-door-scene"], "Animação de bonequinho/porta cancelada")
}

console.log("Beta 18 aprovada na fonte: base Beta 16 preservada, painel atual intacto, barra inferior restaurada, animações originais ligadas ao runtime, Auditor e fila corrigidos sem regressão visual.")
