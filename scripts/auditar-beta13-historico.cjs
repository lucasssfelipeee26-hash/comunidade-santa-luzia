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
  for (const marker of markers) {
    if (!text.includes(marker)) throw new Error(`${label}: marcador ausente em ${relative}: ${marker}`)
  }
  return text
}

function assertOrder(text, markers, label) {
  let previous = -1
  for (const marker of markers) {
    const current = text.indexOf(marker, previous + 1)
    if (current < 0) throw new Error(`${label}: marcador ausente após a etapa anterior: ${marker}`)
    previous = current
  }
}

if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) {
  throw new Error(`Android estável foi alterado: ${stable.versionName}/code${stable.versionCode}`)
}
if (beta.versionName !== "2.0.0-beta.13" || beta.versionCode !== 20013) {
  throw new Error(`Beta 13/code20013 esperada: ${beta.versionName}/code${beta.versionCode}`)
}
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("ApplicationId da Beta foi alterado.")

const capacitor = requireAll("capacitor.config.ts", [
  "2.0.0-beta.13",
  "webDir: \"android-web\"",
  "!motionBeta && valorServidor",
  "SantaLuziaOriginalUIOffline/2",
  "SantaLuziaWindowsBeta/0.1.0-beta.19",
], "Capacitor local-first")
if (/errorPath|offline\.html|offline-bridge\.html/.test(capacitor)) throw new Error("Interface offline paralela voltou ao Capacitor.")

const door = requireAll("components/profile-door-icon.tsx", [
  "direction = \"enter\"",
  "direction === \"exit\"",
  "slDoorPersonEnter",
  "slDoorPersonExit",
  "slDoorPersonEnterLoop",
  "slDoorPersonExitLoop",
], "Bonequinho/porta")
if (!door.includes("infinite")) throw new Error("Ciclos animados da porta foram removidos.")

const login = requireAll("components/login-form.tsx", [
  "ProfileDoorIcon",
  "data-login-door-transition=\"true\"",
  "setEntering(true)",
  "await new Promise<void>((resolve) => window.setTimeout(resolve, doorTransitionDelay()))",
  "loop={false}",
  "direction=\"enter\"",
], "Entrada pela porta")
assertOrder(login, [
  "const res = await login(usuario, senha)",
  "setEntering(true)",
  "await new Promise<void>((resolve) => window.setTimeout(resolve, doorTransitionDelay()))",
  "const solicitado = searchParams.get(\"destino\")",
  "router.replace(destinoSeguro",
], "Entrada deve ocorrer após autenticação e antes da navegação")

const header = requireAll("components/area-header.tsx", [
  "setLeaving(true)",
  "data-logout-door-transition",
  "disabled={leaving}",
  "loop={!leaving}",
  "direction=\"exit\"",
  "await new Promise<void>((resolve) => window.setTimeout(resolve, doorTransitionDelay()))",
], "Saída pela porta")
assertOrder(header, [
  "setLeaving(true)",
  "const logoutRequest = fetch",
  "await new Promise<void>((resolve) => window.setTimeout(resolve, doorTransitionDelay()))",
  "router.replace(\"/area-restrita/login\")",
], "Saída deve animar antes de voltar ao login")

const moderator = requireAll("components/moderador-dashboard.tsx", [
  "AdministracaoModerador",
  "EquipeNoPainel",
  "Atrasos",
  "Presenças",
], "Painel moderador")
if (moderator.includes("Meu relatório") || moderator.includes("MeuRelatorioWindows")) throw new Error("Meu relatório voltou indevidamente ao painel.")

requireAll("components/equipe-no-painel.tsx", [
  "data-team-profile-rail",
  "overflow-x-auto",
  "snap-mandatory",
  "placeholder=\"Buscar\"",
  "santa-luzia:perfis-publicos:v1",
], "Perfis horizontais")

requireAll("android-web/motion/android-podium-beta12.js", [
  ".sl-r5-card-trophy",
  "normalizeCard",
  "valid.slice(1)",
  ".sl-b11-card-trophy",
], "Pódio sem troféu duplicado")

requireAll("android-web/motion/android-scroll-stability-beta12.js", [
  "touchmove",
  "abruptUpwardJump",
  "maxYDuringDownGesture",
  "scrollRestoration",
], "Estabilidade de rolagem")
requireAll("android-web/motion/android-performance-beta12.js", [
  "overflow-anchor:none",
  "fps",
  "slMotionPerformance",
], "Desempenho/FPS")

requireAll("android-web/motion/android-auditor-beta12.js", [
  "SantaLuziaAuditor",
  "unhandledrejection",
  "offline-functional-audit",
  "scroll-jump",
  "missing-icons",
  "exportReport",
], "Auditor Santa Luzia")
requireAll("components/diagnostico-santa-luzia.tsx", [
  "Auditor Santa Luzia",
  "Executar auditoria agora",
  "Gerar relatório técnico",
], "Tela de diagnóstico")

requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/OfflineStorePlugin.java", [
  "DB_VERSION = 2",
  "setWriteAheadLoggingEnabled(true)",
  "PRAGMA synchronous=FULL",
  "PRAGMA integrity_check",
  "TABLE_BACKUPS",
  "backupPreviousValue",
  "recoverDocument",
  "beginTransaction",
], "SQLite Android")
requireAll("lib/data-protection.ts", [
  "backups-santa-luzia",
  "MAX_BACKUPS = 8",
  "atomicWrite",
  "fs.fsyncSync",
  "recoverIfNeeded",
  "createBackup",
  "database-health.json",
], "Proteção do banco do servidor")

requireAll("android-web/motion/android-local-first-beta8.js", [
  "queueEligible",
  "createQueuedMutation",
  "optimisticMutation",
  "replayQueue",
  "/api/escalas",
  "/api/formacoes",
  "/api/perfil",
], "Fila local-first")
requireAll("android-web/motion/android-domain-bridge-beta10.js", [
  "reportar_atraso",
  "minha-presenca",
  "caminho-da-luz",
  "whatajong",
  "optimisticAdminQuiz",
  "optimisticTheme",
], "Domínio offline")
requireAll("android-web/motion/android-quiz-offline-beta10.js", [
  "quiz-liturgia",
  "OfflineStore",
  "writeRankingCache",
], "Quiz offline")

requireAll("components/administracao-moderador.tsx", [
  "fisicamenteOnline",
  "Ações destrutivas não são salvas em fila offline",
  "EXCLUIR",
  "ZERAR",
  "excluir_cadastro",
  "resetar_ranking",
], "Administração segura")

console.log("Auditoria histórica Beta 13 aprovada: offline local-first, bancos protegidos, Auditor, rolagem/FPS, perfis, pódio, administração e animações de entrada/saída ligadas aos eventos reais. Android estável 1.0.6/code18 preservado.")
