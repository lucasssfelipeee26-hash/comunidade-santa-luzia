const fs = require("node:fs")
const path = require("node:path")

const dir = __dirname
const original = path.join(dir, "auditar-beta18-recovery.cjs")
const temp = path.join(dir, ".auditar-beta20-heranca.tmp.cjs")

let source = fs.readFileSync(original, "utf8")

source = source
  .replace(
    'if (beta.versionName !== "2.0.0-beta.18" || beta.versionCode !== 20018) throw new Error(`Beta 18 inválida: ${beta.versionName}/code${beta.versionCode}`)',
    'if (beta.versionName !== "2.0.0-beta.21" || beta.versionCode !== 20021) throw new Error(`Beta 21 inválida: ${beta.versionName}/code${beta.versionCode}`)'
  )
  .replace('className="object-contain object-center"', 'className="object-cover object-center"')
  .replace('data-auditor-santa-luzia="beta18"', 'data-auditor-santa-luzia="beta21"')
  .replace('Beta 18 · Auditor + Deep Scan', 'Beta 21 · Auditor Profundo')
  .replace('contagem por defeitos únicos', 'caixa-preta persistente')
  .replace(
    '["2.0.0-beta.18", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v4", "CLEAN_VERSION_KEY"]',
    '["2.0.0-beta.21", "unique-signatures", "occurrences", "santa-luzia-diagnostico-v6", "CLEAN_VERSION_KEY", "route-transition-v2", "blackBox", "applicationExitInfo", "perfettoTraceMarkers"]'
  )

const bottomStart = source.indexOf('// IMAGENS EXPLICATIVAS — barra inferior deve existir online/offline e usar animação ORIGINAL contínua.')
const bottomEndMarker = 'requireAll("android-local/entry.tsx", ["<MobileBottomNav />"], "Android local: barra inferior precisa estar montada fora das rotas")'
const bottomEndAt = source.indexOf(bottomEndMarker, bottomStart)
if (bottomStart < 0 || bottomEndAt < 0) throw new Error("Bloco de auditoria da barra inferior não localizado")
const bottomEnd = bottomEndAt + bottomEndMarker.length
const beta21BottomAudit = `// BETA 21 — barra inferior estável, sem animação contínua nos ícones.
const bottom = requireAll("components/mobile-bottom-nav.tsx", [
  'label: "Início", icon: Home',
  'label: "Escala", icon: CalendarDays',
  'label: "Formação", icon: GraduationCap',
  'label: "Quiz", icon: BrainCircuit',
  'className="mobile-app-bottom-nav',
  'data-bottom-nav-network-stable="true"',
  'data-bottom-nav-static-icon="true"',
  'transition-colors duration-100',
], "Beta 21: barra inferior estática e estável")
if (/me === undefined\\s*&&\\s*sessaoOffline === undefined\\)\\s*return null/.test(bottom)) throw new Error("Barra inferior: não pode desaparecer enquanto resolve a sessão online/offline")
forbid("components/mobile-bottom-nav.tsx", [
  "function animarIcone",
  "svg.animate(frames",
  'motion: "home"',
  "UserRound",
  "data-sl-nav-motion",
  "@keyframes slR11Panel",
  "@keyframes slR10ScaleMotion",
  "@keyframes slR11Page",
  "@keyframes slR11Library",
  "@keyframes slR11Quiz",
], "Beta 21: não reintroduzir animação contínua na barra inferior nem trocar Início por Perfil")
requireAll("android-local/entry.tsx", ["<MobileBottomNav />"], "Android local: barra inferior precisa estar montada fora das rotas")`
source = source.slice(0, bottomStart) + beta21BottomAudit + source.slice(bottomEnd)

source = source.replace(
  'console.log("Beta 18 aprovada nas exigências visuais e funcionais:',
  'console.log("Herança visual e funcional aprovada na Beta 21:'
)

try {
  fs.writeFileSync(temp, source)
  require(temp)
} finally {
  fs.rmSync(temp, { force: true })
}
