const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
let falhas = 0
function ler(rel) { return fs.readFileSync(path.join(raiz, rel), "utf8") }
function exigir(condicao, titulo) {
  if (condicao) console.log(`✓ ${titulo}`)
  else { falhas += 1; console.error(`✗ ${titulo}`) }
}
function versaoNoMinimo(atual, minima) {
  const a = String(atual).split(".").map((n) => Number(n) || 0)
  const b = String(minima).split(".").map((n) => Number(n) || 0)
  const tamanho = Math.max(a.length, b.length)
  for (let i = 0; i < tamanho; i += 1) {
    const av = a[i] || 0
    const bv = b[i] || 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return true
}

console.log("\nAUDITORIA UX/NATIVA — SANTA LUZIA\n")

const bottom = ler("components/mobile-bottom-nav.tsx")
const header = ler("components/site-header.tsx")
const visitante = ler("app/visitante/page.tsx")
const notificacoes = ler("components/notification-center.tsx")
const storeNotif = ler("lib/notificacoes.ts")
const formacao = ler("components/formacao-membros.tsx")
const offline = ler("android-web/offline.html")
const bootstrap = ler("android-web/index.html")
const splash = ler("native-assets/android/res/values/styles.xml")
const launcher = ler("native-assets/android/res/values/ic_launcher_background.xml")
const progresso = ler("components/navigation-progress.tsx")
const build = JSON.parse(ler("config/android-build.json"))

exigir(/const areaItems = \[[\s\S]*label: "Início"[\s\S]*label: "Escala"[\s\S]*label: "Formação"[\s\S]*label: "Quiz"/.test(bottom), "Barra autenticada contém Início, Escala, Formação e Quiz")
const blocoArea = bottom.match(/const areaItems = \[([\s\S]*?)\n\]/)?.[1] || ""
exigir(!blocoArea.includes('label: "Visitante"') && !blocoArea.includes('label: "Painel"'), "Barra autenticada não contém Visitante nem Painel")
exigir(bottom.includes("carregarSessaoOffline"), "Barra inferior recupera sessão local sem internet")
exigir(header.includes('filter((link) => link.href !== "/visitante")'), "Menu superior remove Início para usuário autenticado")
exigir(header.includes('curto: "Painel", icon: PrayerPersonIcon'), "Painel usa o ícone da pessoa em oração")
exigir(visitante.includes("!autenticado &&") && visitante.includes("Modo visitante"), "Faixa Modo visitante só aparece sem sessão")
exigir(storeNotif.includes("24 * 60 * 60 * 1000") && storeNotif.includes("removerExpiradas"), "Notificações expiram após 24 horas")
exigir(!notificacoes.includes("Ao abrir o sino, as notificações são consideradas vistas."), "Cabeçalho de notificações não exibe instrução técnica")
exigir(notificacoes.includes("z-[120]") && notificacoes.includes("safe-area-inset-bottom"), "Central de notificações fica acima da navegação e respeita área segura")
exigir(!formacao.includes('"CONFIRMADA"') && formacao.includes('>CANCELADA</span>'), "Formação não exibe selo CONFIRMADA e preserva CANCELADA")
exigir(!offline.includes("Tentar conectar") && !offline.includes("Santa Luzia Offline") && !offline.includes("Modo local."), "Interface local não exibe mensagens de erro/conexão")
exigir(offline.includes('bottomTabs=[["inicio"') && offline.includes('"Quiz"]]'), "Navegação local usa Início, Escala, Formação e Quiz")
exigir(offline.includes('window.addEventListener("online"'), "Retorno da internet é automático no modo local")
exigir(!bootstrap.includes("Tentar novamente") && !bootstrap.includes("Conecte o aparelho à internet"), "Tela local de abertura não pede reconexão")
exigir(splash.includes("windowSplashScreenBackground\">@color/santa_luzia_surface") && splash.includes("windowSplashScreenAnimatedIcon\">@mipmap/ic_launcher"), "Splash nativa usa superfície marfim e ícone adaptativo")
exigir(!splash.includes("@drawable/splash") && !splash.includes("windowSplashScreenBackground\">@color/colorPrimaryDark"), "Splash antiga vermelha foi removida")
exigir(launcher.includes("#FFF8EE"), "Fundo do ícone adaptativo segue a identidade marfim")
exigir(progresso.includes("top-[max(8px,env(safe-area-inset-top))]") && progresso.includes("h-1"), "Barra de progresso foi deslocada e ampliada")
exigir(versaoNoMinimo(build.versionName, "1.0.6") && build.versionCode >= 17, "Build mantém compatibilidade UX da linha 1.0.6+")

// A base React/Capacitor continua independente da linguagem usada nas classes Android.
// Kotlin pode ser acrescentado gradualmente sem reescrever a camada web; a compilação
// Gradle/Android completa continua sendo a verificação definitiva de interoperabilidade.
const mainActivity = ler("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java")
exigir(mainActivity.includes("extends BridgeActivity") && mainActivity.includes("registerPlugin"), "Ponte Capacitor nativa permanece compatível com extensões Android")

console.log(`\nAuditoria UX/nativa: ${falhas} falha(s).`)
if (falhas) process.exit(1)
console.log("Auditoria UX/nativa aprovada.\n")
