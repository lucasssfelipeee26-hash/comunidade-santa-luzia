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
function requireText(content, marker, label) {
  if (!content.includes(marker)) throw new Error(`${label}: marcador ausente: ${marker}`)
}
function requireAny(content, markers, label) {
  if (!markers.some((marker) => content.includes(marker))) throw new Error(`${label}: nenhum marcador encontrado: ${markers.join(" | ")}`)
}
function requireAll(relative, markers, label) {
  const content = read(relative)
  for (const marker of markers) requireText(content, marker, `${label} (${relative})`)
  return content
}

if (stable.versionCode !== 18 || stable.versionName !== "1.0.6") throw new Error(`A Motion Beta não pode alterar o Android estável: encontrado ${stable.versionName}/code${stable.versionCode}.`)
if (beta.applicationId === "br.com.comunidadesantaluzia.app") throw new Error("applicationId da Beta colide com o aplicativo oficial.")
if (!/^2\.0\.0-beta\.\d+$/.test(beta.versionName)) throw new Error(`Versionamento Motion Beta inválido: ${beta.versionName}`)
if (!Number.isInteger(beta.versionCode) || beta.versionCode < 20001) throw new Error("versionCode da Motion Beta deve usar faixa isolada >= 20001.")
if (!/^https:\/\//.test(beta.serverUrl)) throw new Error("Servidor de sincronização da Beta deve usar HTTPS.")
if (beta.windowsBeta.commit !== "1c798019ebcb7ace6fbaa762fab398b92385a361") throw new Error("A Motion Beta deve mirar a Windows Beta 0.1.0-beta.19 registrada.")

const capacitor = requireAll("capacitor.config.ts", ["SANTA_LUZIA_MOTION_BETA", "SantaLuziaMotionBeta/", "SantaLuziaWindowsBeta/0.1.0-beta.19", "url: url.origin", "allowNavigation: [url.hostname]"], "Capacitor/WebView")
requireAny(capacitor, ["2.0.0-beta.5", "2.0.0-beta.6"], "Capacitor versionamento Motion")
requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java", [beta.applicationId, "windows-motion-fixes.css", "windows-behavior-fixes.js", "windows-beta7-polish.js", "windows-preload-v5.js", "windows-beta-runtime.js", "android-motion-beta.js", "setDomStorageEnabled(true)", "WebSettings.LOAD_DEFAULT", "evaluateJavascript", "30000"], "MainActivity Motion")

const androidPatch = requireAll("android-web/motion/android-motion-beta.js", ["Formação mais recente", "Histórico anterior", "DELAY_SEEN_PREFIX", "AQUECER_CACHE_PRIVADO", "prefers-reduced-motion", "viewerId", "latestConfirmed"], "Runtime Motion Android")
if (/raw\.githubusercontent\.com|api\.github\.com\/repos/.test(androidPatch)) throw new Error("Runtime Motion Android não pode baixar código remoto durante a execução.")
requireAll("android-web/motion/windows-motion-fixes.css", ["slHeaderMenuEnter"], "CSS Motion Windows")
requireAll("android-web/motion/windows-behavior-fixes.js", ["daily-presence-v1", "Presença diária", "Conferir resultado"], "Behavior Windows")
requireAll("android-web/motion/windows-beta7-polish.js", ["weekly-presence-v3", "Constância de Luz", "DAILY_POINTS = 2", "WEEK_DAYS", "Meu login diário", "14 pts", "replaceJoiasWithJogos", "enhanceRanking", "decorateProfileTitle", "sl-b7-route-enter"], "Polimento Windows Beta")
requireAll("android-web/motion/windows-preload-v5.js", ["Pódio da equipe", "sl-top-avatar", "sl-trophy-3d", "aplicarMenuModerador", "aplicarTabs", "aplicarRanking"], "Preload visual Windows")
requireAll("android-web/motion/windows-beta-runtime.js", ['const revision = "14"', "sl-r10-profile-icon", "sl-r12-quiz-visible", 'data-sl-nav-motion="quiz"', "enhanceProfileAndSoundControls", "enhanceAnimatedNavigationIcons"], "Runtime Windows revisão 14")

requireAll("components/controle-presencas-formacao.tsx", ["X-Santa-Luzia-Windows-Beta", "data-windows-beta-presence-center", "relatorioPorPessoa", "Acompanhamento por pessoa", "tiposRelatorio", "Advertências", "Atrasos", "Digite um nome para consultar o relatório individual."], "Tela real de Presenças/Registros/Atrasos")
requireAll("components/late-arrival-banner.tsx", ["santa-luzia:atraso-banner:", "Registro de pontualidade confirmado", "ocorrencia.id", "localStorage.setItem"], "Banner de atraso visto uma vez")
requireAll("components/formacao-membros.tsx", ["Formação mais recente", "Histórico anterior", "historicoRecente", "historicoAnterior", "ParticipacaoConfirmada", "MinhaPresencaControle", "Falta justificada", "Presença bloqueada por enquanto", "salvarCacheFormacoes"], "Tela real de Formação")
requireAll("components/gerenciador-formacoes.tsx", ["Gerenciar Formação", "cancelada", "motivo_cancelamento", "arquivo"], "Gerenciamento de Formação")
requireAll("components/editor-escala.tsx", ["editandoId", "iniciarEdicao", "cancelarEdicao", "celebracaoLiturgica", "tempoLiturgico", "corLiturgica", "cicloDominical", "dataLiturgica", "/api/liturgia?data=", "X-Santa-Luzia-Windows-Beta", "Selecione a celebração litúrgica indicada pelo iLiturgia.", "Escala aberta para edição. Altere os dados e salve."], "Editor de Escalas completo")
requireAll("components/escala-publica.tsx", ["salvarCacheEscalas", "data-windows-beta-scale", "Celebração litúrgica", "JustificarAusenciaEscala", "minha_justificativa", "Falta justificada", "Justificar falta", "X-Santa-Luzia-Windows-Beta"], "Escala pública com liturgia e justificativa")
requireAll("app/api/escalas/[id]/minha-justificativa/route.ts", ["windowsBeta", "salvarJustificativaEscala", "Sua falta já foi justificada", "Falta justificada na escala", "x-santa-luzia-windows-beta"], "API de justificativa da escala")
requireAll("app/api/escalas/[id]/route.ts", ["PATCH", "celebracaoLiturgica", "tempoLiturgico", "corLiturgica", "cicloDominical"], "API de edição de escala")
requireAll("app/api/formacoes/presencas/resumo/route.ts", ["advertencias", "atrasos", "observacao", "x-santa-luzia-windows-beta"], "API de relatório de presenças")
requireAll("components/ranking-interativo.tsx", ["Jornada Litúrgica", "Quiz", "Joias", "Ranking", "Avulsos", "carregarCacheRanking", "QuizCountdown", "CaminhoDaLuzEntry"], "Jornada/Quiz/Kiss/Ranking")
requireAll("components/area-menu.tsx", ["motion?:", "presence", "record", "data-sl-nav-motion", "Presenças", "Registro"], "Menu/Painel com ícones e animações")
requireAll("components/meu-relatorio-windows.tsx", ["Meu relatório", "Presença", "Atraso", "data-windows-beta-personal-report", "X-Santa-Luzia-Windows-Beta", "SantaLuziaWindowsBeta"], "Relatório individual Windows Beta")
requireAll("components/membro-dashboard.tsx", ["MeuRelatorioWindows", "Meu Perfil"], "Painel do membro")
requireAll("components/moderador-dashboard.tsx", ["MeuRelatorioWindows", "Painel"], "Painel do moderador")
requireAll("public/sw.js", ["PRIVATE_CACHE", "AQUECER_CACHE_PRIVADO", "/area-restrita/membro", "/area-restrita/moderador", "/formacao", "/area-restrita/ranking"], "Service Worker local-first")

const snapshot = read("components/android-offline-snapshot-runtime.tsx")
for (const marker of ["OfflineStore", "snapshot", "fila", "formacoes", "ranking", "escalas"]) if (!snapshot.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Snapshot offline sem marcador: ${marker}`)
requireAll("components/server-sync-runtime.tsx", ["sincronizarRelatosAtrasoPendentes", "sincronizarPresencasFormacaoPendentes", "salvarCacheEscalas", "salvarCacheFormacoes", "networkStatusChange"], "Sincronização local-first")

console.log("[motion-beta] Auditoria de paridade Windows 0.1.0-beta.19 → Android aprovada.")
console.log(`[motion-beta] Android estável preservado: ${stable.versionName}/code${stable.versionCode}.`)
console.log(`[motion-beta] Beta isolada: ${beta.versionName}/code${beta.versionCode} — ${beta.applicationId}.`)
console.log("[motion-beta] Telas auditadas: Presenças, Registros, Atrasos, Formação, Escala, Painel, Jornada/Quiz/Kiss, Ranking, offline e sync.")
