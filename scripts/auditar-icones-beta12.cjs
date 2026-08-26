const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
function read(relative) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${relative}`)
  return fs.readFileSync(file, "utf8")
}
function requireMarkers(file, markers, label) {
  const text = read(file)
  const missing = markers.filter((marker) => !text.includes(marker))
  if (missing.length) throw new Error(`${label}: marcadores ausentes em ${file}: ${missing.join(", ")}`)
}

requireMarkers("components/mobile-bottom-nav.tsx", [
  "Home", "BookOpenText", "CalendarDays", "Library", "LogIn", "GraduationCap", "BrainCircuit", "UserRound",
  "label: \"Início\"", "label: \"Liturgia\"", "label: \"Escala\"", "label: \"Biblioteca\"", "label: \"Perfil\"", "label: \"Formação\"", "label: \"Quiz\"",
  "slNavProfile", "sl-nav-icon-shell",
], "Barra inferior")
const bottomNav = read("components/mobile-bottom-nav.tsx")
if (bottomNav.includes("ProfileDoorIcon")) throw new Error("Barra inferior voltou a usar a porta como ícone permanente de Perfil.")

requireMarkers("components/site-header.tsx", [
  "BookOpenText", "CalendarDays", "Library", "PrayerPersonIcon", "sl-menu-motion-icon", "motion: \"book\"", "motion: \"calendar\"", "motion: \"library\"",
], "Menu superior")
requireMarkers("app/visitante/page.tsx", [
  "BookOpenText", "CalendarDays", "Library", "data-original-home-icon", "sl-home-shortcut-icon", "bg-[#5b071b]", "text-[#f2cf62]",
], "Atalhos originais da Home")
requireMarkers("android-web/motion/android-motion-beta.js", [
  "sl-home-runtime-icon", "ensureHomeShortcutIcons", '"/liturgia"', '"/escala"', '"/biblioteca"',
], "Correção de ícones da Home local")

requireMarkers("components/profile-door-icon.tsx", ["is-enter", "is-exit", "direction?: \"enter\" | \"exit\""], "Ícone estático da porta")
requireMarkers("components/door-transition-scene.tsx", [
  "data-door-scene", "sl-door-scene-enter", "sl-door-scene-exit", "slSceneEnter", "slSceneExit", "slEnterWave", "sl-door-frame", "sl-door-person",
], "Cena animada de entrada/saída")
requireMarkers("components/login-form.tsx", ["DoorTransitionScene", "direction=\"enter\"", "data-login-door-transition"], "Entrada")
requireMarkers("components/area-header.tsx", ["DoorTransitionScene", "direction=\"exit\"", "data-logout-door-transition", "logout-door"], "Saída")

requireMarkers("components/area-menu.tsx", [
  "LayoutDashboard", "Clock3", "Sparkles", "CalendarCheck2", "BookOpen", "ClipboardCheck", "ClipboardPlus", "BrainCircuit", "Database", "Palette", "Bug", "CalendarDays", "PrayerPersonIcon",
  "curto: \"Painel\"", "curto: \"Atrasos\"", "curto: \"Jornada\"", "curto: \"Escalas\"", "curto: \"Formação\"", "curto: \"Presenças\"", "curto: \"Registro\"", "curto: \"Quizzes\"", "curto: \"Dados\"", "curto: \"Cores\"", "curto: \"Diagnóstico\"",
  "/area-restrita/moderador/administracao",
], "Menu da Área Restrita")

requireMarkers("components/moderador-dashboard.tsx", ["ShieldCheck", "Clock", "ClipboardCheck", "UserCheck", "UserX", "ChevronRight"], "Painel do moderador")
requireMarkers("components/membro-dashboard.tsx", ["BookOpen", "Trophy", "Clock", "FileText", "Lock", "Send"], "Painel do membro")
requireMarkers("components/escala-publica.tsx", ["CalendarDays", "History", "Clock", "Cross", "Users", "WifiOff", "ShieldCheck"], "Escalas e histórico")
requireMarkers("components/diagnostico-santa-luzia.tsx", ["Activity", "AlertTriangle", "CheckCircle2", "Download", "Gauge", "RefreshCw", "Send", "ShieldCheck", "Trash2", "Wifi", "Wrench"], "Diagnóstico")

// A stack Windows é somente referência visual histórica e é copiada numa etapa
// posterior do CI. Se já estiver presente, também validamos seu marcador; se não,
// a auditoria Android não deve falhar antes da etapa de cópia.
const runtimeFile = path.join(root, "android-web", "motion", "windows-beta-runtime.js")
if (fs.existsSync(runtimeFile)) {
  const runtime = fs.readFileSync(runtimeFile, "utf8")
  if (!runtime.includes("sl-r10-profile-icon")) throw new Error("Runtime de referência sem marcador de perfil.")
}
const clock = read("android-web/motion/android-motion-parity-beta11.js")
if (!clock.includes("sl-b11-live-clock")) throw new Error("Compatibilidade do relógio animado de Atrasos ausente.")
const auditor = read("android-web/motion/android-auditor-beta12.js")
for (const marker of ["missing-icons", "icon-audit", "/area-restrita/moderador/administracao"]) if (!auditor.includes(marker)) throw new Error(`Auditor em execução sem marcador: ${marker}`)

console.log("Auditoria de ícones Beta 14 aprovada: Home, menus, Perfil, cena de porta, Dados, painéis e Diagnóstico estão rastreáveis; o Auditor monitora ausências no DOM.")
