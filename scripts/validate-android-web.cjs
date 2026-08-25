const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
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
  entry: path.join(root, "android-local", "entry.tsx"),
  scales: path.join(root, "components", "escala-publica.tsx"),
  diagnostics: path.join(root, "components", "diagnostico-santa-luzia.tsx"),
  protection: path.join(root, "lib", "data-protection.ts"),
  instrumentation: path.join(root, "instrumentation.ts"),
  profiles: path.join(root, "components", "equipe-no-painel.tsx"),
  profileDoor: path.join(root, "components", "profile-door-icon.tsx"),
  areaHeader: path.join(root, "components", "area-header.tsx"),
  siteHeader: path.join(root, "components", "site-header.tsx"),
  home: path.join(root, "app", "visitante", "page.tsx"),
  moderator: path.join(root, "components", "moderador-dashboard.tsx"),
  admin: path.join(root, "components", "administracao-moderador.tsx"),
  adminApi: path.join(root, "app", "api", "app", "admin-dados", "route.ts"),
}
for (const [name, file] of Object.entries(required)) if (!fs.existsSync(file)) throw new Error(`Arquivo Android obrigatório ausente (${name}): ${path.relative(root, file)}`)
for (const forbidden of ["offline.html", "offline-bridge.html"]) if (fs.existsSync(path.join(root, "android-web", forbidden))) throw new Error(`Motion Beta não pode conter interface offline paralela: android-web/${forbidden}`)

const index = fs.readFileSync(required.index, "utf8")
if (!/<!doctype html>/i.test(index) || !index.includes("SANTA LUZIA")) throw new Error("index.html Android inválido.")

const versioned = [
  [required.motion10, "runtime de sincronização", "2.0.0-beta.11"],
  [required.nativeFetch, "ponte de fetch nativa", "2.0.0-beta.10"],
  [required.domain, "regras de domínio", "2.0.0-beta.10"],
  [required.quiz, "Quiz Litúrgico offline", "2.0.0-beta.10"],
  [required.navigation, "navegação local", "2.0.0-beta.10"],
  [required.constancia, "Constância de Luz", "2.0.0-beta.11"],
  [required.report, "ponte de relatório", "2.0.0-beta.11"],
  [required.parity, "compatibilidade Motion Android", "2.0.0-beta.12"],
  [required.auditor, "Auditor Santa Luzia", "2.0.0-beta.12"],
  [required.performance, "performance Android", "2.0.0-beta.12"],
  [required.scroll, "estabilidade de rolagem", "2.0.0-beta.12"],
  [required.podium, "pódio atual", "2.0.0-beta.12"],
]
for (const [file, label, version] of versioned) {
  const js = fs.readFileSync(file, "utf8")
  new vm.Script(js, { filename: path.relative(root, file) })
  if (!js.includes(version)) throw new Error(`${label} sem versão ${version}.`)
}

const nativeFetch = fs.readFileSync(required.nativeFetch, "utf8")
for (const marker of ["SyncHttp", "FormData", "bodyBase64", "formDataJson", "/api/", "liturgia-completa"]) if (!nativeFetch.includes(marker)) throw new Error(`Ponte nativa sem marcador: ${marker}`)
const domain = fs.readFileSync(required.domain, "utf8")
for (const marker of ["reportar_atraso", "minha-presenca", "caminho-da-luz", "whatajong", "optimisticAdminQuiz", "optimisticTheme"]) if (!domain.includes(marker)) throw new Error(`Domínio base sem marcador: ${marker}`)
const quiz = fs.readFileSync(required.quiz, "utf8")
for (const marker of ["quiz-liturgia", "OfflineStore", "writeRankingCache", "/api/quizzes/liturgia/responder"]) if (!quiz.includes(marker)) throw new Error(`Quiz offline sem marcador: ${marker}`)
const navigation = fs.readFileSync(required.navigation, "utf8")
for (const marker of ["santa-luzia:local-route", "downloadApi", "history.pushState"]) if (!navigation.includes(marker)) throw new Error(`Navegação local sem marcador: ${marker}`)

const parity = fs.readFileSync(required.parity, "utf8")
for (const marker of ["motionClockCompatibilityBeta12", "sl-b11-live-clock", ".sl-b11-card-trophy", "santa-luzia:local-route"]) if (!parity.includes(marker)) throw new Error(`Compatibilidade Android sem marcador: ${marker}`)
if (parity.includes("function trophyMarkup") || parity.includes("slB11CupFloat")) throw new Error("A camada de compatibilidade ainda desenha o troféu Beta 11 antigo.")

const podium = fs.readFileSync(required.podium, "utf8")
for (const marker of [".sl-r5-card-trophy", "viewBox=\"0 0 64 64\"", "sl-b11-card-trophy", "Pódio da equipe", "normalizeCard", "valid.slice(1)"]) if (!podium.includes(marker)) throw new Error(`Pódio Beta 12 sem marcador: ${marker}`)

const perf = fs.readFileSync(required.performance, "utf8")
for (const marker of ["scroll-behavior:auto", "overflow-anchor:none", "duration:180", "slMotionPerformance", "fps", "sl-b7-route-shield"]) if (!perf.includes(marker)) throw new Error(`Performance Beta 12 sem marcador: ${marker}`)
const scroll = fs.readFileSync(required.scroll, "utf8")
for (const marker of ["touchmove", "abruptUpwardJump", "maxYDuringDownGesture", "scroll-jump", "scrollRestoration", "behavior: \"instant\""]) if (!scroll.includes(marker)) throw new Error(`Estabilidade de rolagem Beta 12 sem marcador: ${marker}`)
const auditor = fs.readFileSync(required.auditor, "utf8")
for (const marker of ["SantaLuziaAuditor", "unhandledrejection", "route-transition", "fps-sample", "scroll-jump", "missing-icons", "offline-functional-audit", "exportReport", "Santa-Luzia-Diagnostico-"]) if (!auditor.includes(marker)) throw new Error(`Auditor Beta 12 sem marcador: ${marker}`)
for (const forbidden of ["document.cookie", "authorization:", "localStorage.getItem(\"token\""] ) if (auditor.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Auditor coleta dado sensível proibido: ${forbidden}`)

const scales = fs.readFileSync(required.scales, "utf8")
for (const marker of ["data-escala-history-enabled", "Histórico", "data-escala-historico", "escala.data < hoje", "carregarCacheEscalas", "salvarCacheEscalas"]) if (!scales.includes(marker)) throw new Error(`Histórico de escalas sem marcador: ${marker}`)
const diagnostics = fs.readFileSync(required.diagnostics, "utf8")
for (const marker of ["Auditor Santa Luzia", "Executar auditoria agora", "Gerar relatório técnico", "SantaLuziaAuditor"]) if (!diagnostics.includes(marker)) throw new Error(`Tela de diagnóstico sem marcador: ${marker}`)
const protection = fs.readFileSync(required.protection, "utf8")
for (const marker of ["backups-santa-luzia", "MAX_BACKUPS = 8", "fs.fsyncSync", "recoverIfNeeded", "createBackup", "database-health.json"]) if (!protection.includes(marker)) throw new Error(`Proteção de dados sem marcador: ${marker}`)
if (!fs.readFileSync(required.instrumentation, "utf8").includes("iniciarProtecaoDadosSantaLuzia")) throw new Error("Proteção do banco não é iniciada pelo servidor.")

const profiles = fs.readFileSync(required.profiles, "utf8")
for (const marker of ["data-team-profile-rail", "overflow-x-auto", "snap-mandatory", "placeholder=\"Buscar\"", "setSelecionado", "santa-luzia:perfis-publicos:v1"]) if (!profiles.includes(marker)) throw new Error(`Faixa horizontal de perfis sem marcador: ${marker}`)
const door = fs.readFileSync(required.profileDoor, "utf8")
for (const marker of ["direction = \"enter\"", "is-exit", "slDoorPersonEnterLoop", "slDoorPersonExitLoop", "infinite"]) if (!door.includes(marker)) throw new Error(`Ícone de porta animada sem marcador: ${marker}`)
const areaHeader = fs.readFileSync(required.areaHeader, "utf8")
for (const marker of ["ProfileDoorIcon", "direction=\"exit\"", "data-sl-nav-motion=\"logout-door\""]) if (!areaHeader.includes(marker)) throw new Error(`Logout animado sem marcador: ${marker}`)
const siteHeader = fs.readFileSync(required.siteHeader, "utf8")
for (const marker of ["sl-menu-motion-icon", "motion: \"book\"", "motion: \"calendar\"", "PrayerPersonIcon"]) if (!siteHeader.includes(marker)) throw new Error(`Ícones animados do menu sem marcador: ${marker}`)
const home = fs.readFileSync(required.home, "utf8")
for (const marker of ["data-original-home-icon", "sl-home-shortcut-icon", "bg-[#5b071b]", "text-[#f2cf62]"]) if (!home.includes(marker)) throw new Error(`Ícones originais da Home sem marcador: ${marker}`)
const moderator = fs.readFileSync(required.moderator, "utf8")
if (!moderator.includes("AdministracaoModerador")) throw new Error("Painel moderador sem administração de dados.")
const admin = fs.readFileSync(required.admin, "utf8")
for (const marker of ["EXCLUIR", "ZERAR", "/api/app/admin-dados", "fisicamenteOnline", "Ações destrutivas não são salvas em fila offline"]) if (!admin.includes(marker)) throw new Error(`Administração do moderador sem marcador: ${marker}`)
const adminApi = fs.readFileSync(required.adminApi, "utf8")
for (const marker of ["excluir_cadastro", "resetar_ranking", "excluirContaUsuario", "salvarRankingAjuste", "-linha.pontos", "Acesso exclusivo do moderador"]) if (!adminApi.includes(marker)) throw new Error(`API administrativa sem marcador: ${marker}`)

const entry = fs.readFileSync(required.entry, "utf8")
for (const marker of ["MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo", "ModeradorPresencasPage", "GerenciadorRanking", "GerenciadorTema", "DiagnosticoSantaLuzia", "/area-restrita/moderador/diagnostico", "MobileBottomNav"]) if (!entry.includes(marker)) throw new Error(`Frontend local sem componente/rota: ${marker}`)

const mission = fs.readFileSync(required.mission, "utf8")
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")
console.log("Pré-validação Beta 12: offline original, histórico, perfis horizontais, portas animadas, administração, Auditor, proteção de dados, performance/scroll e pódio atual presentes.")
