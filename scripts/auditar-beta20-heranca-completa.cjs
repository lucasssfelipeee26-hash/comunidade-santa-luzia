const fs = require("node:fs")
const path = require("node:path")

const dir = __dirname
const original = path.join(dir, "auditar-beta18-recovery.cjs")
const temp = path.join(dir, ".auditar-beta20-heranca.tmp.cjs")

let source = fs.readFileSync(original, "utf8")
source = source
  .replace('if (beta.versionName !== "2.0.0-beta.18" || beta.versionCode !== 20018) throw new Error(`Beta 18 inválida: ${beta.versionName}/code${beta.versionCode}`)', 'if (beta.versionName !== "2.0.0-beta.21" || beta.versionCode !== 20021) throw new Error(`Beta 21 inválida: ${beta.versionName}/code${beta.versionCode}`)')
  .replace('\'className="object-contain object-center"\'', '\'className="object-cover object-center"\'')
  .replace('\'data-auditor-santa-luzia="beta18"\'', '\'data-auditor-santa-luzia="beta21"\'')
  .replace('"Beta 18 · Auditor + Deep Scan"', '"Beta 21 · Auditor Profundo"')
  .replace('"contagem por defeitos únicos"', '"caixa-preta persistente"')
  .replace('["2.0.0-beta.18", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v4", "CLEAN_VERSION_KEY"]', '["2.0.0-beta.21", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v6", "CLEAN_VERSION_KEY", "route-transition-v2", "blackBox", "applicationExitInfo", "perfettoTraceMarkers"]')
  .replace('// IMAGENS EXPLICATIVAS — barra inferior deve existir online/offline e usar animação ORIGINAL contínua.', '// BETA 21 — barra inferior deve existir online/offline, mas seus ícones ficam estáticos por decisão atual do usuário.')
  .replace('\'label: "Início", icon: Home, motion: "panel"\'', '\'label: "Início", icon: Home\'')
  .replace('\'label: "Escala", icon: CalendarDays, motion: "scale"\'', '\'label: "Escala", icon: CalendarDays\'')
  .replace('\'label: "Formação", icon: GraduationCap, motion: "formation"\'', '\'label: "Formação", icon: GraduationCap\'')
  .replace('\'label: "Quiz", icon: BrainCircuit, motion: "quiz"\'', '\'label: "Quiz", icon: BrainCircuit\'')
  .replace('\'data-sl-nav-motion={"motion" in item ? item.motion : undefined}\'', '\'data-bottom-nav-static-icon="true"\'')
  .replace('\'[data-sl-nav-motion="panel"] svg{animation:slR11Panel 2.2s ease-in-out infinite}\'', '\'transition-colors duration-100\'')
  .replace('\'[data-sl-nav-motion="scale"] svg{animation:slR10ScaleMotion 2.1s ease-in-out infinite}\'', '\'active:opacity-80\'')
  .replace('\'[data-sl-nav-motion="liturgy"] svg,[data-sl-nav-motion="formation"] svg{animation:slR11Page 2.5s ease-in-out infinite}\'', '\'aria-current={active ? "page" : undefined}\'')
  .replace('\'[data-sl-nav-motion="library"] svg{animation:slR11Library 2.3s ease-in-out infinite}\'', '\'data-bottom-nav-static-icon="true"\'')
  .replace('\'[data-sl-nav-motion="quiz"] svg{animation:slR11Quiz 2s ease-in-out infinite}\'', '\'data-bottom-nav-network-stable="true"\'')
  .replace('"@keyframes slR11Panel",', '\'"data-bottom-nav-static-icon=\\"true\\"",\'')
  .replace('"@keyframes slR10ScaleMotion",', '\'"transition-colors duration-100",\'')
  .replace('"@keyframes slR11Page",', '\'"active:opacity-80",\'')
  .replace('"@keyframes slR11Library",', '\'"aria-current={active ? \\"page\\" : undefined}",\'')
  .replace('"@keyframes slR11Quiz",', '\'"data-bottom-nav-network-stable=\\"true\\"",\'')
  .replace('["function animarIcone", "svg.animate(frames", \'motion: "home"\', "UserRound"]', '["function animarIcone", "svg.animate(frames", \'motion: "home"\', "UserRound", "data-sl-nav-motion", "@keyframes slR11Panel", "@keyframes slR10ScaleMotion", "@keyframes slR11Page", "@keyframes slR11Library", "@keyframes slR11Quiz"]')
  .replace('"Imagem explicativa: barra inferior e animações originais"', '"Beta 21: barra inferior estática e estável"')
  .replace('"Imagem explicativa: não substituir animação original nem Início por Perfil"', '"Beta 21: não reintroduzir animação na barra inferior nem trocar Início por Perfil"')
  .replace('console.log("Beta 18 aprovada nas exigências visuais e funcionais:', 'console.log("Herança completa Beta 18 aprovada dentro da Beta 21 com Auditor Profundo:')

try {
  fs.writeFileSync(temp, source)
  require(temp)
} finally {
  fs.rmSync(temp, { force: true })
}
