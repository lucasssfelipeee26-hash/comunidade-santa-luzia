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
  if (missing.length) throw new Error(`${label}: ícones/marcadores ausentes em ${file}: ${missing.join(", ")}`)
}

requireMarkers("components/mobile-bottom-nav.tsx", [
  "Home", "BookOpenText", "CalendarDays", "Library", "LogIn", "GraduationCap", "BrainCircuit", "ProfileDoorIcon",
  "label: \"Início\"", "label: \"Liturgia\"", "label: \"Escala\"", "label: \"Biblioteca\"", "label: \"Perfil\"", "label: \"Formação\"", "label: \"Quiz\"",
  "direction=\"enter\"", "sl-nav-icon-shell",
], "Barra inferior")

requireMarkers("components/site-header.tsx", [
  "BookOpenText", "CalendarDays", "Library", "PrayerPersonIcon", "sl-menu-motion-icon", "motion: \"book\"", "motion: \"calendar\"", "motion: \"library\"",
], "Menu superior")
requireMarkers("app/visitante/page.tsx", [
  "BookOpenText", "CalendarDays", "Library", "data-original-home-icon", "sl-home-shortcut-icon", "bg-[#5b071b]", "text-[#f2cf62]",
], "Atalhos originais da Home")
requireMarkers("components/profile-door-icon.tsx", [
  "slDoorPersonEnterLoop", "slDoorPersonExitLoop", "is-enter", "is-exit", "direction?: \"enter\" | \"exit\"",
], "Ícone de perfil/porta")
requireMarkers("components/area-header.tsx", ["ProfileDoorIcon", "direction=\"exit\"", "logout-door"], "Ícone de sair")

requireMarkers("components/area-menu.tsx", [
  "LayoutDashboard", "Clock3", "Sparkles", "CalendarCheck2", "BookOpen", "ClipboardCheck", "ClipboardPlus", "BrainCircuit", "Palette", "Bug", "CalendarDays", "PrayerPersonIcon",
  "curto: \"Painel\"", "curto: \"Atrasos\"", "curto: \"Jornada\"", "curto: \"Escalas\"", "curto: \"Formação\"", "curto: \"Presenças\"", "curto: \"Registro\"", "curto: \"Quizzes\"", "curto: \"Cores\"", "curto: \"Diagnóstico\"",
], "Menu da Área Restrita")

requireMarkers("components/moderador-dashboard.tsx", ["ShieldCheck", "Clock", "ClipboardCheck", "UserCheck", "UserX", "ChevronRight"], "Painel do moderador")
requireMarkers("components/membro-dashboard.tsx", ["BookOpen", "Trophy", "Clock", "FileText", "Lock", "Send"], "Painel do membro")
requireMarkers("components/escala-publica.tsx", ["CalendarDays", "History", "Clock", "Cross", "Users", "WifiOff", "ShieldCheck"], "Escalas e histórico")
requireMarkers("components/diagnostico-santa-luzia.tsx", ["Activity", "AlertTriangle", "CheckCircle2", "Download", "Gauge", "RefreshCw", "ShieldCheck", "Trash2", "Wifi", "Wrench"], "Diagnóstico")

const runtime = read("android-web/motion/windows-beta-runtime.js")
if (!runtime.includes("sl-r10-profile-icon")) throw new Error("Runtime Motion sem referência de ícone de perfil.")
const clock = read("android-web/motion/android-motion-parity-beta11.js")
if (!clock.includes("sl-b11-live-clock")) throw new Error("Compatibilidade do ícone animado de Atrasos ausente.")
const auditor = read("android-web/motion/android-auditor-beta12.js")
if (!auditor.includes("missing-icons")) throw new Error("Auditor em execução não monitora desaparecimento de ícones.")

console.log("Auditoria de ícones Beta 12 aprovada: atalhos originais, menu superior, barra inferior, perfil entrando, logout saindo, painéis, Escalas e Diagnóstico estão rastreáveis; Auditor monitora ausências no DOM.")
