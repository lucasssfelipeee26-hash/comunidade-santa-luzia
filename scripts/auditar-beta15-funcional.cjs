const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function file(relative) { return path.join(root, relative) }
function read(relative) {
  const target = file(relative)
  if (!fs.existsSync(target)) throw new Error(`Arquivo obrigatório ausente: ${relative}`)
  return fs.readFileSync(target, "utf8")
}
function all(relative, markers, label) {
  const text = read(relative)
  const missing = markers.filter((marker) => !text.includes(marker))
  if (missing.length) throw new Error(`${label}: faltando ${missing.join(" | ")}`)
  return text
}
function none(relative, markers, label) {
  const text = read(relative)
  const found = markers.filter((marker) => text.includes(marker))
  if (found.length) throw new Error(`${label}: conteúdo cancelado/proibido encontrado: ${found.join(" | ")}`)
}

if (beta.versionName !== "2.0.0-beta.15" || beta.versionCode !== 20015) throw new Error(`Beta 15/code20015 esperada: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("ApplicationId da Beta foi alterado.")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) throw new Error(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}`)

if (fs.existsSync(file("components/door-transition-scene.tsx")) || fs.existsSync(file("components/profile-door-icon.tsx"))) {
  throw new Error("Arquivos da animação cancelada ainda existem.")
}
all("components/login-form.tsx", ["LogIn", "data-login-standard-icon=\"true\"", "router.replace"], "Login padrão")
none("components/login-form.tsx", ["DoorTransitionScene", "ProfileDoorIcon", "data-login-door-transition", "setEntering(true)"], "Login")
all("components/area-header.tsx", ["LogOut", "data-standard-logout=\"true\"", "data-logout-confirmation=\"true\"", "Deseja sair?", "Sim, sair", ">Não<"], "Saída padrão")
none("components/area-header.tsx", ["DoorTransitionScene", "ProfileDoorIcon", "data-logout-door-transition", "logout-door"], "Saída")

all("components/mobile-bottom-nav.tsx", [
  '{ href: "/visitante", label: "Início", icon: Home',
  "data-bottom-nav-network-stable=\"true\"",
  "me?.sessao ?? sessaoOffline ?? null",
  "Escala", "Formação", "Quiz",
], "Barra inferior")
none("components/mobile-bottom-nav.tsx", ["ProfileDoorIcon", 'label: "Perfil"'], "Barra inferior")

all("components/site-header.tsx", [
  "data-main-profile-access=\"hamburger\"",
  "Abrir meu perfil",
  'href="/area-restrita"',
  "Entrar", "Cadastro", "Baixar app",
], "Cabeçalho público")
none("components/site-header.tsx", ["Centro Litúrgico", "Escala do Dia", 'curto: "Biblioteca"', "PrayerPersonIcon"], "Menu público duplicado")

all("components/hero.tsx", ["data-hero-clean-image=\"true\"", "object-contain object-center", "Servir a Deus"], "Banner limpo")
none("components/hero.tsx", ["Liturgia diária", "Escala do dia", "BookOpenText", "CalendarDays"], "Atalhos sobre a imagem")
all("app/visitante/page.tsx", [
  "data-home-public-shortcuts=\"4\"",
  'title: "Centro Litúrgico"', 'title: "Escala do Dia"', 'title: "Biblioteca"', 'title: "Liturgia Diária"',
  'href: "/visitante#liturgia"',
], "Quatro atalhos públicos")

all("components/equipe-no-painel.tsx", [
  "data-team-profile-status-rail", "overflow-x-auto", "snap-x", "touch-pan-x",
  "placeholder=\"Buscar perfil por nome\"", "data-profile-viewer-banner", "data-profile-close",
  "data-profile-photo-frame=\"preserve-ratio\"", "data-profile-photo-full=\"true\"", "object-contain object-center",
  "Classificação", "Pontos", "Aproveitamento", "santa-luzia:perfis-publicos:v1",
], "Perfis estilo Status")
all("components/perfis-equipe.tsx", ["data-profiles-page=\"status-model\"", "Deslize pelas fotos ou pesquise pelo nome", "EquipeNoPainel"], "Página Perfis")
all("components/area-menu.tsx", ["UsersRound", "/area-restrita/perfis", 'curto: "Perfis"', "Database", "/area-restrita/moderador/administracao", 'curto: "Dados"', "Bug", 'curto: "Diagnóstico"'], "Menu da Área Restrita")

const moderator = read("components/moderador-dashboard.tsx")
if (moderator.includes("AdministracaoModerador")) throw new Error("Administração de dados voltou ao painel principal.")
all("components/administracao-moderador.tsx", [
  "data-admin-database-tools", "data-admin-default-open", "data-admin-member-list", "data-admin-member-select", "data-admin-delete-confirm", "data-admin-ranking-reset",
  "EXCLUIR", "ZERAR", "/api/app/admin-dados", "fisicamenteOnline",
], "Administração de dados")
all("app/api/app/admin-dados/route.ts", ["export async function GET", "export async function POST", "excluir_cadastro", "resetar_ranking", "excluirContaUsuario", "salvarRankingAjuste", "Acesso exclusivo do moderador"], "API administrativa")
all("android-local/entry.tsx", ["AdministracaoModerador", "AdministracaoRoute", "/area-restrita/moderador/administracao", "PerfisEquipe", "/area-restrita/perfis", "DiagnosticoSantaLuzia", "MobileBottomNav"], "Rotas Android locais")

all("android-web/motion/android-motion-beta.js", [
  "2.0.0-beta.15", "ensureFourthHomeCard", "data-sl-home-generated-fourth", "ensureScaleHistorySearch", "data-scale-history-search", "data-sl-history-date", "data-sl-history-liturgical", "Tempo litúrgico", "Mostrando a escala mais recente",
], "Motion Beta 15")
all("components/escala-publica.tsx", ["data-escala-history-enabled", "data-escala-historico", "Histórico", "escala.data < hoje", "carregarCacheEscalas", "salvarCacheEscalas"], "Escalas")

const auditor = all("android-web/motion/android-auditor-beta12.js", [
  "2.0.0-beta.15", "auditorBeta15", "SantaLuziaAuditor", "runSelfAudit", "exportReport", "shareLastReport",
  "javascript-error", "unhandled-rejection", "fetch-error", "fps-sample", "long-task", "scroll-jump", "missing-icons",
  "offlineReadinessAudit", "onlineEndpointAudit", "local-db-health", "/api/app/admin-dados", "Santa-Luzia-Diagnostico-",
], "Auditor Santa Luzia")
new vm.Script(auditor, { filename: "android-auditor-beta12.js" })
if (auditor.length < 15000 || auditor.trim() === "PLACEHOLDER") throw new Error("Auditor Santa Luzia truncado/inacabado.")
none("android-web/motion/android-auditor-beta12.js", [".sl-profile-door-icon", "DoorTransitionScene"], "Auditor")
all("components/diagnostico-santa-luzia.tsx", [
  "data-auditor-santa-luzia=\"beta15\"", "Beta 15 · diagnóstico online e offline", "2.0.0-beta.15",
  "Executar auditoria agora", "Gerar relatório técnico", "Compartilhar relatório", "Quedas FPS", "Saltos", "Ícones", "Banco", "Fila",
], "Tela do Auditor")
all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/DiagnosticReportPlugin.java", ["saveReport", "shareLastReport", "MediaStore.Downloads", "FileProvider.getUriForFile"], "Relatório Android")

all("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/OfflineStorePlugin.java", [
  "DB_VERSION = 2", "setWriteAheadLoggingEnabled(true)", "PRAGMA synchronous=FULL", "PRAGMA integrity_check", "TABLE_BACKUPS", "backupPreviousValue", "recoverDocument", "beginTransaction",
], "SQLite local")
all("lib/data-protection.ts", ["MAX_BACKUPS = 8", "atomicWrite", "fs.fsyncSync", "recoverIfNeeded", "createBackup", "database-health.json"], "Proteção do banco servidor")
all("android-web/motion/android-local-first-beta8.js", ["queueEligible", "optimisticMutation", "replayQueue", "/api/escalas", "/api/formacoes", "/api/perfil"], "Local-first")
all("android-web/motion/android-domain-bridge-beta10.js", ["reportar_atraso", "minha-presenca", "caminho-da-luz", "whatajong"], "Domínio offline")
all("android-web/motion/android-scroll-stability-beta12.js", ["native-free-scroll", "touchmove", "scroll-jump", "overflow-y:auto!important", "touch-action:pan-y"], "Rolagem vertical")
none("android-web/motion/android-scroll-stability-beta12.js", ["scrollTo({ top: target"], "Rolagem")

const localApp = file("android-web/local-app.js")
if (fs.existsSync(localApp)) {
  if (fs.statSync(localApp).size < 250000) throw new Error(`Bundle Android incompleto: ${fs.statSync(localApp).size} bytes`)
  const bundle = fs.readFileSync(localApp, "utf8")
  for (const marker of [
    "data-login-standard-icon", "data-standard-logout", "data-logout-confirmation", "data-bottom-nav-network-stable",
    "data-main-profile-access", "data-team-profile-status-rail", "data-profile-viewer-banner", "data-profile-close", "data-profile-photo-frame",
    "data-admin-database-tools", "/area-restrita/moderador/administracao", "data-auditor-santa-luzia",
  ]) if (!bundle.includes(marker)) throw new Error(`Bundle local sem marcador Beta 15: ${marker}`)
  for (const forbidden of ["DoorTransitionScene", "data-door-scene", "slDoorPersonEnter", "slDoorPersonExit", "ProfileDoorIcon"]) {
    if (bundle.includes(forbidden)) throw new Error(`Bundle local ainda contém animação cancelada: ${forbidden}`)
  }
  const index = read("android-web/index.html")
  for (const marker of ["/local-app.js", "android-native-fetch-beta10.js", "android-local-first-beta8.js", "android-domain-bridge-beta10.js", "android-auditor-beta12.js", "android-scroll-stability-beta12.js", "android-motion-beta.js"]) if (!index.includes(marker)) throw new Error(`HTML Android empacotado sem ${marker}`)
  if (/offline\.html|offline-bridge\.html/.test(index)) throw new Error("Interface offline paralela reapareceu.")
}

console.log("Auditoria Beta 15 aprovada: animação cancelada removida; Início/navegação, Home, Perfis estilo Status, Escalas pesquisáveis, Administração, Auditor, rolagem, banco e offline local-first presentes; estável 1.0.6/code18 preservado.")
