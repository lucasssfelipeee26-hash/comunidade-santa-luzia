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
  const missing = markers.filter((marker) => !text.includes(marker))
  if (missing.length) throw new Error(`${label}: faltando ${missing.join(" | ")}`)
  return text
}
function absent(relative, markers, label) {
  const text = read(relative)
  const found = markers.filter((marker) => text.includes(marker))
  if (found.length) throw new Error(`${label}: conteúdo proibido encontrado: ${found.join(" | ")}`)
}

if (beta.versionName !== "2.0.0-beta.14" || beta.versionCode !== 20014) throw new Error(`Config Beta 14 inválida: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("ApplicationId da Motion Beta mudou.")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) throw new Error(`Android oficial foi alterado: ${stable.versionName}/code${stable.versionCode}`)

all("capacitor.config.ts", ["2.0.0-beta.14", "webDir: \"android-web\"", "!motionBeta && valorServidor", "SantaLuziaOriginalUIOffline/2"], "Arquitetura local")
absent("capacitor.config.ts", ["errorPath", "offline.html", "offline-bridge.html"], "Shell offline paralelo")

all("components/door-transition-scene.tsx", [
  "data-door-scene", "sl-door-scene-enter", "sl-door-scene-exit", "slSceneEnter", "slSceneExit", "slEnterWave",
  "#6f172c", "#d4af37", "sl-door-frame", "sl-door-depth", "sl-door-person", "sl-arm-l", "sl-leg-l",
], "Cena de porta Santa Luzia")
all("components/login-form.tsx", ["DoorTransitionScene", "direction=\"enter\"", "setEntering(true)", "doorTransitionDelay()", "data-login-door-transition"], "Entrada pela porta")
all("components/area-header.tsx", ["DoorTransitionScene", "direction=\"exit\"", "setLeaving(true)", "doorTransitionDelay()", "data-logout-door-transition"], "Saída pela porta")

all("components/equipe-no-painel.tsx", [
  "data-team-profile-status-rail", "overflow-x-auto", "snap-x", "touch-pan-x", "placeholder=\"Buscar perfil por nome\"",
  "data-profile-viewer-banner", "data-profile-close", "Ranking", "Pontos", "Aproveitamento", "santa-luzia:perfis-publicos:v1",
], "Perfis estilo Status")

all("components/diagnostico-santa-luzia.tsx", [
  "data-auditor-santa-luzia=\"beta14\"", "Executar auditoria agora", "Gerar relatório técnico", "Compartilhar relatório",
  "Quedas FPS", "Saltos", "Ícones", "Banco", "Fila", "Modo offline",
], "Tela do Auditor")
const auditor = all("android-web/motion/android-auditor-beta12.js", [
  "2.0.0-beta.14", "runSelfAudit", "exportReport", "shareLastReport", "offlineReadinessAudit", "onlineEndpointAudit",
  "javascript-error", "unhandled-rejection", "fetch-error", "fps-sample", "scroll-jump", "missing-icons", "local-db-health",
  "/api/app/admin-dados", "/area-restrita/moderador/administracao",
], "Núcleo do Auditor")
if (auditor.length < 15000 || auditor.trim() === "PLACEHOLDER") throw new Error("Auditor Santa Luzia está truncado/inacabado.")
all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/DiagnosticReportPlugin.java", [
  "saveReport", "shareLastReport", "MediaStore.Downloads", "Santa Luzia/Diagnosticos", "FileProvider.getUriForFile", "MAX_REPORT_BYTES",
], "Relatório nativo Android")
all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java", ["DiagnosticReportPlugin.class", "setVerticalScrollBarEnabled(true)", "setScrollbarFadingEnabled(false)"], "Registro nativo e rolagem")
all("native-assets/android/res/xml/diagnostic_file_paths.xml", ["external-files-path", "Santa-Luzia-Diagnosticos"], "Compartilhamento de relatório")
all("scripts/prepare-android.cjs", ["androidx.core.content.FileProvider", "${applicationId}.fileprovider", "@xml/diagnostic_file_paths"], "Manifesto do relatório")

all("android-web/motion/android-scroll-stability-beta12.js", ["2.0.0-beta.14", "native-free-scroll", "touchmove", "overflow-y:auto!important", "touch-action:pan-y", "scroll-jump"], "Rolagem vertical")

all("components/mobile-bottom-nav.tsx", ["UserRound", "motion: \"profile\"", "slNavProfile"], "Ícone de Perfil")
absent("components/mobile-bottom-nav.tsx", ["ProfileDoorIcon"], "Porta não pode ficar rodando como Perfil")
all("android-web/motion/android-motion-beta.js", ["2.0.0-beta.14", "sl-home-runtime-icon", "ensureHomeShortcutIcons", '"/liturgia"', '"/escala"', '"/biblioteca"'], "Ícones da Home")
all("components/area-menu.tsx", ["Database", "/area-restrita/moderador/administracao", "curto: \"Dados\"", "Bug", "curto: \"Diagnóstico\""], "Menu do moderador")
absent("components/moderador-dashboard.tsx", ["AdministracaoModerador"], "Administração não deve ficar no painel principal")
all("android-local/entry.tsx", ["AdministracaoModerador", "AdministracaoRoute", "/area-restrita/moderador/administracao", "DiagnosticoSantaLuzia"], "Rotas locais")
all("components/administracao-moderador.tsx", [
  "data-admin-database-tools", "data-admin-default-open", "data-admin-member-list", "data-admin-member-select", "data-admin-delete-confirm", "data-admin-ranking-reset",
  "EXCLUIR", "ZERAR", "/api/app/admin-dados", "Cadastro de", "Placar de",
], "Administração funcional")
all("app/api/app/admin-dados/route.ts", ["export async function GET", "export async function POST", "excluir_cadastro", "resetar_ranking", "excluirContaUsuario", "salvarRankingAjuste"], "Endpoint administrativo")

all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/OfflineStorePlugin.java", [
  "DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA synchronous=FULL", "PRAGMA integrity_check", "TABLE_BACKUPS", "backupPreviousValue", "recoverDocument", "beginTransaction",
], "SQLite local")
all("lib/data-protection.ts", ["MAX_BACKUPS = 8", "atomicWrite", "fs.fsyncSync", "recoverIfNeeded", "createBackup", "database-health.json"], "Proteção do banco do servidor")
all("android-web/motion/android-local-first-beta8.js", ["queueEligible", "optimisticMutation", "replayQueue", "/api/escalas", "/api/formacoes", "/api/perfil"], "Fila offline")
all("android-web/motion/android-domain-bridge-beta10.js", ["reportar_atraso", "minha-presenca", "caminho-da-luz", "whatajong"], "Domínio offline")

console.log("Beta 14 aprovada na auditoria de completude: cena da porta, perfis estilo Status, Auditor online/offline com relatório nativo, rolagem, ícones, administração, banco e offline local-first presentes; Android oficial 1.0.6/code18 preservado.")
