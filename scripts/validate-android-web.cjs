const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const required = {
  index: path.join(root, "android-web", "index.html"),
  mission: path.join(root, "android-web", "caminho-da-luz", "index.html"),
  motion10: path.join(root, "android-web", "motion", "android-original-ui-beta10.js"),
  nativeFetch: path.join(root, "android-web", "motion", "android-native-fetch-beta10.js"),
  domain: path.join(root, "android-web", "motion", "android-domain-bridge-beta10.js"),
  quiz: path.join(root, "android-web", "motion", "android-quiz-offline-beta10.js"),
  navigation: path.join(root, "android-web", "motion", "android-local-navigation-beta10.js"),
  constancia: path.join(root, "android-web", "motion", "android-constancia-luz-beta11.js"),
  report: path.join(root, "android-web", "motion", "android-report-bridge-beta11.js"),
  parity: path.join(root, "android-web", "motion", "android-motion-parity-beta11.js"),
  auditor: path.join(root, "android-web", "motion", "android-auditor-beta12.js"),
  performance: path.join(root, "android-web", "motion", "android-performance-beta12.js"),
  scroll: path.join(root, "android-web", "motion", "android-scroll-stability-beta12.js"),
  podium: path.join(root, "android-web", "motion", "android-podium-beta12.js"),
  motion: path.join(root, "android-web", "motion", "android-motion-beta.js"),
  entry: path.join(root, "android-local", "entry.tsx"),
  scales: path.join(root, "components", "escala-publica.tsx"),
  diagnostics: path.join(root, "components", "diagnostico-santa-luzia.tsx"),
  protection: path.join(root, "lib", "data-protection.ts"),
  instrumentation: path.join(root, "instrumentation.ts"),
  profiles: path.join(root, "components", "equipe-no-painel.tsx"),
  profileDoor: path.join(root, "components", "profile-door-icon.tsx"),
  doorScene: path.join(root, "components", "door-transition-scene.tsx"),
  login: path.join(root, "components", "login-form.tsx"),
  areaHeader: path.join(root, "components", "area-header.tsx"),
  areaMenu: path.join(root, "components", "area-menu.tsx"),
  siteHeader: path.join(root, "components", "site-header.tsx"),
  home: path.join(root, "app", "visitante", "page.tsx"),
  bottomNav: path.join(root, "components", "mobile-bottom-nav.tsx"),
  moderator: path.join(root, "components", "moderador-dashboard.tsx"),
  admin: path.join(root, "components", "administracao-moderador.tsx"),
  adminApi: path.join(root, "app", "api", "app", "admin-dados", "route.ts"),
}

function text(file) { return fs.readFileSync(file, "utf8") }
function requireMarkers(file, label, markers) {
  const value = text(file)
  for (const marker of markers) if (!value.includes(marker)) throw new Error(`${label} sem marcador: ${marker}`)
  return value
}

for (const [name, file] of Object.entries(required)) if (!fs.existsSync(file)) throw new Error(`Arquivo Android obrigatório ausente (${name}): ${path.relative(root, file)}`)
for (const forbidden of ["offline.html", "offline-bridge.html"]) if (fs.existsSync(path.join(root, "android-web", forbidden))) throw new Error(`Motion Beta não pode conter interface offline paralela: android-web/${forbidden}`)
if (beta.versionName !== "2.0.0-beta.14" || beta.versionCode !== 20014) throw new Error(`Validador Beta 14 recebeu ${beta.versionName}/code${beta.versionCode}.`)

const index = text(required.index)
if (!/<!doctype html>/i.test(index) || !index.includes("SANTA LUZIA")) throw new Error("index.html Android inválido.")
for (const marker of ["/local-app.js", "android-native-fetch-beta10.js", "android-local-first-beta8.js", "android-domain-bridge-beta10.js", "android-auditor-beta12.js", "android-scroll-stability-beta12.js", "android-motion-beta.js"]) if (!index.includes(marker)) throw new Error(`index.html Android sem ${marker}`)

const versioned = [
  [required.motion10, "runtime de sincronização", "2.0.0-beta.11"],
  [required.nativeFetch, "ponte de fetch nativa", "2.0.0-beta.10"],
  [required.domain, "regras de domínio", "2.0.0-beta.10"],
  [required.quiz, "Quiz Litúrgico offline", "2.0.0-beta.10"],
  [required.navigation, "navegação local", "2.0.0-beta.10"],
  [required.constancia, "Constância de Luz", "2.0.0-beta.11"],
  [required.report, "ponte de relatório", "2.0.0-beta.11"],
  [required.parity, "compatibilidade Motion Android", "2.0.0-beta.12"],
  [required.auditor, "Auditor Santa Luzia", "2.0.0-beta.14"],
  [required.performance, "performance Android", "2.0.0-beta.12"],
  [required.scroll, "rolagem Android", "2.0.0-beta.14"],
  [required.podium, "pódio atual", "2.0.0-beta.12"],
  [required.motion, "camada Motion atual", "2.0.0-beta.14"],
]
for (const [file, label, version] of versioned) {
  const js = text(file)
  new vm.Script(js, { filename: path.relative(root, file) })
  if (!js.includes(version)) throw new Error(`${label} sem versão ${version}.`)
}

requireMarkers(required.nativeFetch, "Ponte nativa", ["SyncHttp", "FormData", "bodyBase64", "formDataJson", "/api/", "liturgia-completa"])
requireMarkers(required.domain, "Domínio base", ["reportar_atraso", "minha-presenca", "caminho-da-luz", "whatajong", "optimisticAdminQuiz", "optimisticTheme"])
requireMarkers(required.quiz, "Quiz offline", ["quiz-liturgia", "OfflineStore", "writeRankingCache", "/api/quizzes/liturgia/responder"])
requireMarkers(required.navigation, "Navegação local", ["santa-luzia:local-route", "downloadApi", "history.pushState"])

const parity = requireMarkers(required.parity, "Compatibilidade Android", ["motionClockCompatibilityBeta12", "sl-b11-live-clock", ".sl-b11-card-trophy", "santa-luzia:local-route"])
if (parity.includes("function trophyMarkup") || parity.includes("slB11CupFloat")) throw new Error("A camada de compatibilidade voltou a desenhar o troféu antigo.")
requireMarkers(required.podium, "Pódio", [".sl-r5-card-trophy", "viewBox=\"0 0 64 64\"", "sl-b11-card-trophy", "Pódio da equipe", "normalizeCard", "valid.slice(1)"])
requireMarkers(required.performance, "Performance", ["scroll-behavior:auto", "overflow-anchor:none", "duration:180", "slMotionPerformance", "fps", "sl-b7-route-shield"])

const scroll = requireMarkers(required.scroll, "Rolagem Beta 14", ["native-free-scroll", "touchmove", "scroll-jump", "touch-action:pan-y", "overflow-y:auto!important"])
if (scroll.includes("scrollTo({ top: target")) throw new Error("Rolagem Beta 14 voltou a reposicionar a tela artificialmente.")

const auditor = requireMarkers(required.auditor, "Auditor Beta 14", ["SantaLuziaAuditor", "runSelfAudit", "unhandledrejection", "route-transition", "fps-sample", "scroll-jump", "missing-icons", "offline-functional-audit", "offlineReadinessAudit", "onlineEndpointAudit", "exportReport", "shareLastReport", "Santa-Luzia-Diagnostico-", "/api/app/admin-dados"])
if (auditor.length < 15000 || auditor.trim() === "PLACEHOLDER") throw new Error("Auditor Beta 14 truncado/inacabado.")
for (const forbidden of ["document.cookie", "authorization:", "localStorage.getItem(\"token\""]) if (auditor.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Auditor coleta dado sensível proibido: ${forbidden}`)

requireMarkers(required.scales, "Histórico de escalas", ["data-escala-history-enabled", "Histórico", "data-escala-historico", "escala.data < hoje", "carregarCacheEscalas", "salvarCacheEscalas"])
requireMarkers(required.diagnostics, "Tela de diagnóstico", ["data-auditor-santa-luzia=\"beta14\"", "Auditor Santa Luzia", "Executar auditoria agora", "Gerar relatório técnico", "Compartilhar relatório", "SantaLuziaAuditor"])
requireMarkers(required.protection, "Proteção de dados", ["backups-santa-luzia", "MAX_BACKUPS = 8", "fs.fsyncSync", "recoverIfNeeded", "createBackup", "database-health.json"])
if (!text(required.instrumentation).includes("iniciarProtecaoDadosSantaLuzia")) throw new Error("Proteção do banco não é iniciada pelo servidor.")

requireMarkers(required.profiles, "Perfis estilo Status", ["data-team-profile-status-rail", "overflow-x-auto", "snap-mandatory", "placeholder=\"Buscar perfil por nome\"", "data-profile-viewer-banner", "data-profile-close", "data-profile-photo-frame=\"preserve-ratio\"", "data-profile-photo-full=\"true\"", "object-contain object-center", "santa-luzia:perfis-publicos:v1"])
requireMarkers(required.profileDoor, "Ícone de porta", ["direction?: \"enter\" | \"exit\"", "is-enter", "is-exit"])
requireMarkers(required.doorScene, "Cena de porta", ["data-door-scene", "sl-door-scene-enter", "sl-door-scene-exit", "slSceneEnter", "slSceneExit", "slEnterWave", "sl-door-frame", "sl-door-person"])
requireMarkers(required.login, "Entrada", ["DoorTransitionScene", "direction=\"enter\"", "setEntering(true)", "data-login-door-transition"])
requireMarkers(required.areaHeader, "Saída", ["DoorTransitionScene", "direction=\"exit\"", "setLeaving(true)", "data-logout-door-transition", "logout-door"])

requireMarkers(required.siteHeader, "Menu superior", ["sl-menu-motion-icon", "motion: \"book\"", "motion: \"calendar\"", "PrayerPersonIcon"])
requireMarkers(required.home, "Ícones originais da Home", ["data-original-home-icon", "sl-home-shortcut-icon", "bg-[#5b071b]", "text-[#f2cf62]"])
requireMarkers(required.motion, "Correção da Home local", ["sl-home-runtime-icon", "ensureHomeShortcutIcons", '"/liturgia"', '"/escala"', '"/biblioteca"'])
const bottomNav = requireMarkers(required.bottomNav, "Barra inferior", ["UserRound", "motion: \"profile\"", "slNavProfile"])
if (bottomNav.includes("ProfileDoorIcon")) throw new Error("Perfil voltou a usar a porta como ícone permanente.")

requireMarkers(required.areaMenu, "Menu do moderador", ["Database", "/area-restrita/moderador/administracao", "curto: \"Dados\"", "Bug", "curto: \"Diagnóstico\""])
const moderator = text(required.moderator)
if (moderator.includes("AdministracaoModerador")) throw new Error("Administração destrutiva reapareceu no painel principal.")
requireMarkers(required.admin, "Administração do moderador", ["data-admin-database-tools", "data-admin-default-open", "data-admin-member-list", "data-admin-delete-confirm", "data-admin-ranking-reset", "EXCLUIR", "ZERAR", "/api/app/admin-dados", "fisicamenteOnline", "Ações destrutivas não são salvas em fila offline"])
requireMarkers(required.adminApi, "API administrativa", ["excluir_cadastro", "resetar_ranking", "excluirContaUsuario", "salvarRankingAjuste", "Acesso exclusivo do moderador"])

requireMarkers(required.entry, "Frontend local", ["MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo", "ModeradorPresencasPage", "GerenciadorRanking", "GerenciadorTema", "DiagnosticoSantaLuzia", "AdministracaoModerador", "/area-restrita/moderador/diagnostico", "/area-restrita/moderador/administracao", "MobileBottomNav"])

const mission = text(required.mission)
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")

console.log("Pré-validação Beta 14 aprovada: interface local-first, cena de porta, perfis estilo Status, Auditor, relatório, rolagem, ícones, administração separada, proteção de dados e pódio presentes.")
