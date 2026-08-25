const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
function read(relative) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${relative}`)
  return fs.readFileSync(file, "utf8")
}

const checks = [
  { area: "Interface", capability: "Interface original inicia sem servidor", file: "capacitor.config.ts", markers: ["webDir: \"android-web\"", "!motionBeta && valorServidor", "SantaLuziaOriginalUIOffline/2"] },
  { area: "Interface", capability: "Rotas React estão empacotadas", file: "android-local/entry.tsx", markers: ["PublicHome", "LiturgiaRoute", "EscalaRoute", "FormacaoRoute", "RankingRoute", "ModeratorRoute"] },
  { area: "Liturgia", capability: "Liturgia diária local por mês", file: "android-web/motion/android-native-fetch-beta10.js", markers: ["liturgia-completa", "/api/liturgia-local", "/api/liturgia"] },
  { area: "iLiturgia", capability: "Acervo offline é empacotado", file: "scripts/build-android-local.cjs", markers: ["prepareAndroidILiturgia", "gerais.html.json.gz", "Manifesto iLiturgia"] },
  { area: "Escalas", capability: "Escalas e histórico permanecem no aparelho", file: "components/escala-publica.tsx", markers: ["carregarCacheEscalas", "salvarCacheEscalas", "data-escala-history-enabled", "Histórico"] },
  { area: "Escalas", capability: "Criação/edição/exclusão entra na fila local", file: "android-web/motion/android-local-first-beta8.js", markers: ["/api/escalas", "queueEligible", "optimisticMutation", "replayQueue"] },
  { area: "Escalas", capability: "Justificativa de ausência atualiza relatório local", file: "android-web/motion/android-report-bridge-beta11.js", markers: ["minha-justificativa", "patchScaleJustification", "justificada"] },
  { area: "Formação", capability: "Lista de formações fica em cache", file: "components/formacao-membros.tsx", markers: ["salvarCacheFormacoes", "carregarCacheFormacoes"] },
  { area: "Formação", capability: "Presença pessoal offline tem fila", file: "android-web/motion/android-domain-bridge-beta10.js", markers: ["minha-presenca", "offline"] },
  { area: "Formação", capability: "Presenças da equipe atualizam relatório local", file: "android-web/motion/android-report-bridge-beta11.js", markers: ["patchFormationBatch", "offline-data"] },
  { area: "Formação", capability: "Anexos existentes são aquecidos para offline", file: "android-web/motion/android-original-ui-beta10.js", markers: ["warmFormationDownloads", "/download"] },
  { area: "Atrasos", capability: "Relato de atraso funciona em fila", file: "android-web/motion/android-domain-bridge-beta10.js", markers: ["reportar_atraso", "offline"] },
  { area: "Atrasos", capability: "Moderação de atraso reflete no relatório", file: "android-web/motion/android-report-bridge-beta11.js", markers: ["patchDelayModeration", "moderar_atraso"] },
  { area: "Ranking", capability: "Ranking tem cache local validado", file: "android-web/motion/android-domain-bridge-beta10.js", markers: ["/api/ranking", "readRankingCache", "writeRankingCache"] },
  { area: "Quiz", capability: "Quiz litúrgico pontua localmente", file: "android-web/motion/android-quiz-offline-beta10.js", markers: ["quiz-liturgia", "OfflineStore", "writeRankingCache"] },
  { area: "Quiz", capability: "Quiz manual preserva resposta pendente sem vazar gabarito", file: "components/ranking-interativo.tsx", markers: ["resultado será calculado quando a internet voltar", "offline_pendente"] },
  { area: "Jogos", capability: "Joias/Caminho da Luz mantém resultado local", file: "android-web/motion/android-domain-bridge-beta10.js", markers: ["caminho-da-luz", "completedRound"] },
  { area: "Jogos", capability: "Whatajong mantém resultado local", file: "android-web/motion/android-domain-bridge-beta10.js", markers: ["whatajong", "completedRound"] },
  { area: "Perfil", capability: "Perfil e equipe usam estado local/cache", file: "android-web/motion/android-member-state-beta8.js", markers: ["/api/membros", "/api/equipe", "/api/perfil"] },
  { area: "Moderador", capability: "Status/promoção/registros entram na fila", file: "android-web/motion/android-member-state-beta8.js", markers: ["/status", "/promover", "/registros"] },
  { area: "Moderador", capability: "Tema e quizzes administrativos têm atualização otimista", file: "android-web/motion/android-domain-bridge-beta10.js", markers: ["optimisticAdminQuiz", "optimisticTheme"] },
  { area: "Constância", capability: "Login diário persiste offline e sincroniza", file: "android-web/motion/android-constancia-luz-beta11.js", markers: ["santa-luzia:constancia-luz:v1", "pending", "/api/constancia-luz", "POINTS_PER_DAY = 2"] },
  { area: "Banco local", capability: "SQLite mantém documentos/snapshots/fila", file: "native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/OfflineStorePlugin.java", markers: ["santa_luzia_local.db", "TABLE_DOCUMENTS", "saveDocument", "saveQueue"] },
  { area: "Sincronização", capability: "Reentrada de rede dispara replay", file: "android-web/motion/android-local-first-beta8.js", markers: ["replayQueue", "online"] },
  { area: "Sincronização", capability: "Servidor é ponte de dados e não origem da UI", file: "native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/SyncHttpPlugin.java", markers: ["BASE_URL", "CookieManager"] },
  { area: "Diagnóstico", capability: "Auditoria pode ser executada sem depender de serviço externo", file: "android-web/motion/android-auditor-beta12.js", markers: ["runSelfAudit", "offline-functional-audit", "exportReport"] },
]

const rows = []
let failures = 0
for (const check of checks) {
  const text = read(check.file)
  const missing = check.markers.filter((marker) => !text.includes(marker))
  const ok = missing.length === 0
  if (!ok) failures += 1
  rows.push({ area: check.area, funcionalidade: check.capability, status: ok ? "OK" : "FALHA", arquivo: check.file, ausentes: missing.join(" | ") })
}

console.log("\nMATRIZ OFFLINE — SANTA LUZIA MOTION BETA 12\n")
console.table(rows.map(({ area, funcionalidade, status }) => ({ area, funcionalidade, status })))
if (failures) {
  console.error(`\n${failures} capacidade(s) offline sem evidência estrutural suficiente.`)
  for (const row of rows.filter((item) => item.status === "FALHA")) console.error(`- ${row.area} · ${row.funcionalidade}: ${row.ausentes} (${row.arquivo})`)
  process.exit(1)
}
console.log(`\n${rows.length}/${rows.length} capacidades offline possuem implementação estrutural verificável. A validação física no aparelho continua obrigatória para desempenho e comportamento do WebView.`)
