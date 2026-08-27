const fs = require("node:fs")
const path = require("node:path")
const root = path.resolve(__dirname, "..")
const beta = require(path.join(root, "config", "android-motion-beta.json"))
const stable = require(path.join(root, "config", "android-build.json"))

function read(rel) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${rel}`)
  return fs.readFileSync(file, "utf8")
}
function requireAll(rel, markers, label) {
  const text = read(rel)
  const missing = markers.filter((m) => !text.includes(m))
  if (missing.length) throw new Error(`${label}: faltando ${missing.join(" | ")}`)
  return text
}
function forbid(rel, markers, label) {
  const text = read(rel)
  const found = markers.filter((m) => text.includes(m))
  if (found.length) throw new Error(`${label}: proibido ${found.join(" | ")}`)
}

if (beta.versionName !== "2.0.0-beta.18" || beta.versionCode !== 20018) throw new Error(`Beta 18 inválida: ${beta.versionName}/code${beta.versionCode}`)
if (beta.applicationId !== "br.com.comunidadesantaluzia.motionbeta") throw new Error("Pacote Beta alterado")
if (stable.versionName !== "1.0.6" || stable.versionCode !== 18) throw new Error(`Android oficial alterado: ${stable.versionName}/code${stable.versionCode}`)

// IMAGENS EXPLICATIVAS — HOME limpa e quatro acessos públicos.
requireAll("components/hero.tsx", [
  'data-hero-clean-image="true"',
  'className="object-contain object-center"',
  "Servir a Deus",
], "Imagem explicativa: banner principal limpo")
forbid("components/hero.tsx", ["Liturgia diária", "Liturgia Diária", "Escala do dia", "Escala do Dia", "href=\"/escala\"", "href=\"/liturgia\""], "Imagem explicativa: atalhos não podem ficar sobre o banner")
requireAll("app/visitante/page.tsx", [
  'data-home-public-shortcuts="4"',
  'title: "Centro Litúrgico"',
  'title: "Escala do Dia"',
  'title: "Biblioteca"',
  'title: "Liturgia Diária"',
  "<Hero />",
], "Imagem explicativa: quatro cards públicos web")

// A Home Android não pode ser uma cópia antiga separada da Home aprovada.
const androidHome = requireAll("android-local/entry.tsx", [
  'data-android-public-home="approved-v18"',
  'data-home-public-shortcuts="4"',
  'title: "Centro Litúrgico"',
  'title: "Escala do Dia"',
  'title: "Biblioteca"',
  'title: "Liturgia Diária"',
  'href: "/liturgia"',
  'href: "/escala"',
  'href: "/biblioteca"',
  'href: "/visitante#liturgia"',
  "BookOpenText",
  "CalendarDays",
  "Library",
  "ScrollText",
  "data-original-home-icon",
  "slHomeBook",
  "slHomeCalendar",
  "lg:grid-cols-4",
  "<Hero />",
], "Imagem explicativa: Home local Android igual à aprovada")
const localTitles = [...androidHome.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]).filter((v) => ["Centro Litúrgico", "Escala do Dia", "Biblioteca", "Liturgia Diária"].includes(v))
if (new Set(localTitles).size !== 4) throw new Error(`Home local Android deve conter exatamente os 4 atalhos públicos aprovados; encontrados ${new Set(localTitles).size}.`)

// IMAGENS EXPLICATIVAS — barra inferior deve existir online/offline e usar animação ORIGINAL contínua.
const bottom = requireAll("components/mobile-bottom-nav.tsx", [
  'label: "Início", icon: Home, motion: "panel"',
  'label: "Escala", icon: CalendarDays, motion: "scale"',
  'label: "Formação", icon: GraduationCap, motion: "formation"',
  'label: "Quiz", icon: BrainCircuit, motion: "quiz"',
  'className="mobile-app-bottom-nav',
  'data-bottom-nav-network-stable="true"',
  'data-sl-nav-motion={"motion" in item ? item.motion : undefined}',
  '[data-sl-nav-motion="panel"] svg{animation:slR11Panel 2.2s ease-in-out infinite}',
  '[data-sl-nav-motion="scale"] svg{animation:slR10ScaleMotion 2.1s ease-in-out infinite}',
  '[data-sl-nav-motion="liturgy"] svg,[data-sl-nav-motion="formation"] svg{animation:slR11Page 2.5s ease-in-out infinite}',
  '[data-sl-nav-motion="library"] svg{animation:slR11Library 2.3s ease-in-out infinite}',
  '[data-sl-nav-motion="quiz"] svg{animation:slR11Quiz 2s ease-in-out infinite}',
  "@keyframes slR11Panel",
  "@keyframes slR10ScaleMotion",
  "@keyframes slR11Page",
  "@keyframes slR11Library",
  "@keyframes slR11Quiz",
], "Imagem explicativa: barra inferior e animações originais")
if (/me === undefined\s*&&\s*sessaoOffline === undefined\)\s*return null/.test(bottom)) throw new Error("Barra inferior: não pode desaparecer enquanto resolve a sessão online/offline")
forbid("components/mobile-bottom-nav.tsx", ["function animarIcone", "svg.animate(frames", 'motion: "home"', "UserRound"], "Imagem explicativa: não substituir animação original nem Início por Perfil")
requireAll("android-local/entry.tsx", ["<MobileBottomNav />"], "Android local: barra inferior precisa estar montada fora das rotas")

// IMAGENS EXPLICATIVAS — menu hamburger sem atalhos duplicados marcados com X.
requireAll("components/site-header.tsx", [
  'data-main-profile-access="hamburger"',
  'aria-label="Abrir meu perfil"',
], "Imagem explicativa: hamburger principal como acesso ao perfil logado")
requireAll("components/area-menu.tsx", [
  "/area-restrita/moderador/administracao",
  "Administração de dados",
  "Database",
  "/area-restrita/perfis",
], "Imagem explicativa: ferramentas no menu")
forbid("components/area-menu.tsx", [
  'curto: "Painel"',
  'curto: "Escala pública"',
  '{ href: "/liturgia"',
  '{ href: "/biblioteca"',
  '{ href: "/escala", label: "Escala do Dia"',
  '{ href: "/formacao", label: "Formação"',
], "Imagem explicativa: atalhos repetidos não podem voltar ao hamburger")

// IMAGENS EXPLICATIVAS — painel não pode recuperar cards já removidos.
requireAll("components/moderador-dashboard.tsx", [
  "<ProfileSettings />", "<ModeratorPromotionPanel />", "<EquipeNoPainel />", '>Atrasos<', '>Presenças<', "Cadastros aguardando aprovação",
], "Painel atual do moderador")
forbid("components/moderador-dashboard.tsx", ["AdministracaoModerador", "Administração de dados", "Meu relatório", "Meu Relatório", "door-transition"], "Imagem explicativa: itens removidos do painel")

// VÍDEO DE PERFIS — faixa estilo Status, busca, modal completo, X e proporção correta.
requireAll("components/equipe-no-painel.tsx", [
  "createPortal",
  "document.body",
  'data-team-profile-status-rail="true"',
  'placeholder="Buscar perfil por nome"',
  'data-profile-viewer-overlay="true"',
  'data-profile-viewer-banner="true"',
  'data-profile-close="true"',
  'data-profile-scroll="true"',
  'data-profile-photo-frame="preserve-ratio"',
  'data-profile-photo-full="true"',
  "object-contain object-center",
  "Classificação",
  "Aproveitamento",
], "Vídeo de perfis")

// IMAGENS EXPLICATIVAS — Escalas recentes em destaque e histórico pesquisável, sem lista infinita.
requireAll("components/escala-publica.tsx", [
  'data-escala-history-enabled="true"',
  'data-escala-history-search="date-liturgical-season"',
  'data-escala-history-filters="true"',
  'data-escala-filter-date="true"',
  'data-escala-filter-season="true"',
  "historicoCompleto.slice(0, 6)",
  "Próxima escala",
  'data-escala-recente={destaque ? "true" : undefined}',
  "tempo_liturgico",
  "Todos os tempos litúrgicos",
], "Imagem explicativa: histórico de Escalas")

// IMAGENS EXPLICATIVAS — saída convencional com confirmação, sem bonequinho/porta.
requireAll("components/area-header.tsx", [
  "LogOut",
  'data-standard-logout="true"',
  'data-logout-confirmation="true"',
  "Deseja sair?",
  ">Não<",
  "Sim, sair",
], "Imagem explicativa: saída")

// DIAGNÓSTICO — só resumo e ações na UI; detalhes técnicos ficam no arquivo.
requireAll("components/diagnostico-santa-luzia.tsx", [
  'data-auditor-santa-luzia="beta18"',
  "Beta 18 · Auditor + Deep Scan",
  "contagem por defeitos únicos",
  "Executar auditoria",
  "Gerar relatório",
  "Compartilhar",
  "Limpar histórico",
  "deleteLastReport",
], "Tela Diagnóstico")
forbid("components/diagnostico-santa-luzia.tsx", ["Eventos recentes", "Versão monitorada", "Dados locais", "Banco SQLite", "Tela atual"], "Diagnóstico simplificado")

// Transições e offline-first.
requireAll("android-local/shims/next-navigation.ts", ["slRouteTransition", "santa-luzia:route-settled", "resetScroll", "requestAnimationFrame"], "Transições")
requireAll("scripts/build-android-local.cjs", ["windows-beta-runtime.js", "windows-beta7-polish.js", "windows-motion-fixes.css", "android-auditor-beta12.js"], "Runtime visual empacotado")
requireAll("scripts/patch-windows-polish-android-beta18.cjs", ["restoreAndroidBottomNav", "updateBottomNav", "não vou alterar a camada visual às cegas"], "Patch cirúrgico do runtime")
forbid("scripts/build-android-local.cjs", ["sanitize-android-beta17"], "Sanitização regressiva")

// Auditor e fila: corrigir erros reais sem apagar a interface.
requireAll("lib/local-first-queue.ts", ["type NativeStoreHandle", "return { store: module.OfflineStore }", "handle.store.loadQueue()", "handle.store.saveQueue"], "Fila nativa")
requireAll("android-web/motion/android-auditor-patch-beta16.js", ["2.0.0-beta.18", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v4", "CLEAN_VERSION_KEY"], "Auditor")
requireAll("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/DiagnosticReportPlugin.java", ["deleteLastReport", "FALHA_REMOVER_RELATORIO"], "Relatório nativo")

// Decisão final do usuário: animação de personagem/porta cancelada em qualquer tela.
for (const rel of ["android-local/entry.tsx", "components/mobile-bottom-nav.tsx", "components/moderador-dashboard.tsx", "components/membro-dashboard.tsx", "components/area-header.tsx", "components/login-form.tsx", "components/site-header.tsx"]) {
  forbid(rel, ["DoorTransitionScene", "ProfileDoorIcon", "data-door-scene", "sl-door-person", "slSceneEnter", "slSceneExit"], "Animação de bonequinho/porta cancelada")
}

console.log("Beta 18 aprovada nas exigências visuais e funcionais: Home web/Android unificada com 4 cards, todas as correções das imagens explicativas e do vídeo de perfis obrigatórias, além de Auditor/fila sem regressão da interface.")
