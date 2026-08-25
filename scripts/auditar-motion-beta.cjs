const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))
function read(relative) { const file = path.join(root, relative); if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${relative}`); return fs.readFileSync(file, "utf8") }
function requireAll(relative, markers, label) { const text = read(relative); for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label}: marcador ausente em ${relative}: ${marker}`); return text }
function forbidAll(relative, markers, label) { const text = read(relative); for (const marker of markers) if (text.includes(marker)) throw new Error(`${label}: marcador proibido em ${relative}: ${marker}`); return text }

if (stable.versionCode !== 18 || stable.versionName !== "1.0.6") throw new Error(`Android estável alterado: ${stable.versionName}/code${stable.versionCode}`)
if (beta.versionName !== "2.0.0-beta.11" || beta.versionCode !== 20011) throw new Error(`Beta 11/code20011 esperada: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("Pacote Beta incorreto.")
if (beta.windowsBeta.commit !== "1c798019ebcb7ace6fbaa762fab398b92385a361") throw new Error("Windows Beta de referência deve ser 0.1.0-beta.19.")

const capacitor = requireAll("capacitor.config.ts", ["2.0.0-beta.11", "!motionBeta && valorServidor", "SantaLuziaOriginalUIOffline/2", "SantaLuziaWindowsBeta/0.1.0-beta.19"], "Capacitor")
if (/errorPath|offline\.html|offline-bridge\.html/.test(capacitor)) throw new Error("Capacitor não pode apontar para interface offline alternativa.")

requireAll("android-local/entry.tsx", [
  "SiteHeader", "Hero", "CentralLiturgicaILiturgia", "EscalaPublica", "BibliotecaCatolica",
  "MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo",
  "PerfisEquipe", "PerfilModerador", "ModeradorEscalaPage", "ModeradorFormacaoPage", "ModeradorPresencasPage",
  "NovoRegistroModerador", "GerenciadorRanking", "GerenciadorTema", "ImportarAcervoLiturgico", "MobileBottomNav",
], "Frontend Android original")

requireAll("components/area-menu.tsx", [
  "Painel", "Atrasos", "Jornada", "Escalas", "Formação", "Presenças", "Registro", "Quizzes", "Cores", "Escala pública", "Meu perfil",
], "Menus originais")
requireAll("components/mobile-bottom-nav.tsx", ["Início", "Escala", "Formação", "Quiz"], "Barra inferior original")
requireAll("components/moderador-dashboard.tsx", ["ProfileSettings", "ModeratorPromotionPanel", "EquipeNoPainel", "Atrasos", "Presenças"], "Painel moderador")
forbidAll("components/moderador-dashboard.tsx", ["MeuRelatorioWindows", "Meu relatório"], "Painel moderador sem relatório pessoal embutido")
requireAll("components/membro-dashboard.tsx", ["ProfileSettings", "MeuProximoCompromisso", "EquipeNoPainel", "Formação", "Jornada", "Atrasos"], "Painel membro")
forbidAll("components/membro-dashboard.tsx", ["MeuRelatorioWindows", "Meu relatório"], "Painel membro sem relatório pessoal embutido")
requireAll("components/meu-relatorio-windows.tsx", ["escopo=me", "data-motion-personal-report", "Advertência", "Atraso", "offline-data"], "Relatório pessoal preservado fora do painel")
requireAll("app/api/formacoes/presencas/resumo/route.ts", ["escopoPessoal", "registrosAdministrativos", "justificativasEscala", "advertencias", "atrasos", "observacoes"], "Resumo unificado")
requireAll("components/formacao-membros.tsx", ["MinhaPresencaControle", "salvarCacheFormacoes", "MaterialFormacao"], "Formação")
requireAll("components/escala-publica.tsx", ["salvarCacheEscalas", "Justificar falta", "Celebração litúrgica"], "Escala")
requireAll("components/ranking-interativo.tsx", ["Jornada Litúrgica", "Quiz", "Joias", "Ranking", "Avulsos", "CaminhoDaLuzEntry"], "Jornada")
requireAll("components/central-atrasos.tsx", ["Central de Atrasos", "enviarOuEnfileirarRelatoAtraso", "Confirmar atraso", "Rejeitar"], "Atrasos")

requireAll("app/api/constancia-luz/route.ts", [
  "Constância de Luz", "PONTOS_POR_DIA = 2", "DIAS_DA_SEMANA = 7", "motivoDaData", "jaContabilizado", "maximoSemanal",
  "America/Cuiaba", "MAX_DIAS_OFFLINE = 14", "notificarMudancasRanking",
], "Constância de Luz no servidor")
requireAll("android-web/motion/android-constancia-luz-beta11.js", [
  "2.0.0-beta.11", "Constância de Luz", "Presença semanal", "POINTS_PER_DAY = 2", "MAX_DAYS = 7", "maximoSemanal: 14",
  "/api/constancia-luz", "sincronização pendente", "santa-luzia:constancia-luz:v1", "santa-luzia:offline:v1:ranking",
], "Constância de Luz local/offline")

const nativeFetch = requireAll("android-web/motion/android-native-fetch-beta10.js", ["SyncHttp", "FormData", "formDataJson", "bodyBase64", "/api/"], "Ponte fetch")
const localFirst = requireAll("android-web/motion/android-local-first-beta8.js", ["queueEligible", "createQueuedMutation", "optimisticMutation", "replayQueue", "/api/escalas", "/api/formacoes", "/api/perfil"], "Fila local-first")
requireAll("android-web/motion/android-member-state-beta8.js", ["/status", "/promover", "/registros", "/api/membros", "/api/equipe"], "Estado local de membros")
requireAll("android-web/motion/android-original-ui-beta10.js", ["2.0.0-beta.11", "/api/auth/me", "/api/formacoes/presencas/resumo?escopo=me", "physicallyOnline", "warmMemberDetails"], "Aquecimento de dados")
requireAll("android-web/motion/android-report-bridge-beta11.js", ["2.0.0-beta.11", "patchMyFormation", "patchFormationBatch", "patchAdministrative", "patchDelayModeration", "escopo=me"], "Relatório local-first")
requireAll("android-web/motion/android-motion-parity-beta11.js", [
  "2.0.0-beta.11", "sl-b11-live-clock", "Pódio da equipe", "sl-b11-card-trophy", "data-motion-personal-report",
  "normalizeTrophy", "[class*=\"card-trophy\"]:not(.sl-b11-card-trophy)", "atuais.slice(1)",
], "Paridade Motion Android e troféu único")
if (!nativeFetch.includes("window.__santaLuziaBrowserFetch") || !localFirst.includes("previousFetch")) throw new Error("Encadeamento fetch nativo -> local-first ausente.")

const main = requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java", ["SyncHttpPlugin.class", "OfflineStorePlugin.class", "CaminhoDaLuzPlugin.class", "WhatajongPlugin.class", "LOAD_DEFAULT"], "MainActivity local")
for (const forbidden of ["MotionOfflineWebViewClient", "ServiceWorkerController", "evaluateJavascript", "LOAD_CACHE_ELSE_NETWORK"]) if (main.includes(forbidden)) throw new Error(`MainActivity contém arquitetura remota antiga: ${forbidden}`)
requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/SyncHttpPlugin.java", ["BASE_URL", "multipart/form-data", "formDataJson", "bodyBase64", "CookieManager", "completedRound", "SantaLuziaWindowsBeta/0.1.0-beta.19"], "SyncHttp")
requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/OfflineStorePlugin.java", ["santa_luzia_local.db", "TABLE_DOCUMENTS", "saveDocument", "loadDocument", "saveQueue", "loadQueue"], "SQLite local")

for (const forbidden of ["android-web/offline.html", "android-web/offline-bridge.html", "native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MotionOfflineWebViewClient.java"]) if (fs.existsSync(path.join(root, forbidden))) throw new Error(`Artefato da arquitetura antiga ainda existe: ${forbidden}`)

const bundle = path.join(root, "android-web", "local-app.js")
if (fs.existsSync(bundle) && fs.statSync(bundle).size < 250000) throw new Error("Bundle local gerado parece incompleto.")
console.log("Auditoria Motion Beta 11 aprovada: offline da Beta 10 preservado; Meu relatório fora dos painéis; relatório pessoal/histórico preservado na área correta; troféu único no pódio; Constância de Luz 2 pts/dia e 14 pts/semana validada; Windows Beta 19 fixada; estável 1.0.6/code18 preservado.")
