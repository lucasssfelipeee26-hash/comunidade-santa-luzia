const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
let falhas = 0
let avisos = 0

function ler(relativo) {
  return fs.readFileSync(path.join(raiz, relativo), "utf8")
}

function existe(relativo) {
  return fs.existsSync(path.join(raiz, relativo))
}

function ok(titulo, detalhe = "") {
  console.log(`✓ ${titulo}${detalhe ? ` — ${detalhe}` : ""}`)
}

function falha(titulo, detalhe = "") {
  falhas += 1
  console.error(`✗ ${titulo}${detalhe ? ` — ${detalhe}` : ""}`)
}

function aviso(titulo, detalhe = "") {
  avisos += 1
  console.warn(`! ${titulo}${detalhe ? ` — ${detalhe}` : ""}`)
}

function exigir(condicao, titulo, detalhe = "") {
  if (condicao) ok(titulo, detalhe)
  else falha(titulo, detalhe)
}

function listarArquivos(pasta, resultado = []) {
  const absoluta = path.join(raiz, pasta)
  if (!fs.existsSync(absoluta)) return resultado
  for (const item of fs.readdirSync(absoluta, { withFileTypes: true })) {
    const relativo = path.join(pasta, item.name)
    if (item.isDirectory()) listarArquivos(relativo, resultado)
    else resultado.push(relativo.replaceAll("\\", "/"))
  }
  return resultado
}

console.log("\nAUDITORIA DE ROBUSTEZ — SANTA LUZIA\n")

const pkg = JSON.parse(ler("package.json"))
const build = JSON.parse(ler("config/android-build.json"))
const release = JSON.parse(ler("config/android-release.json"))
const appRelease = ler("lib/app-release.ts")
const updater = ler("components/android-update-runtime.tsx")
const sync = ler("components/server-sync-runtime.tsx")
const mainActivity = ler("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java")
const updaterNativo = ler("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/AppUpdaterPlugin.java")
const styles = ler("native-assets/android/res/values/styles.xml")
const networkSecurity = ler("native-assets/android/res/xml/network_security_config.xml")

console.log("[1/6] Versões e distribuição")
exigir(pkg.version === build.versionName, "package.json e Android usam o mesmo nome público", `${pkg.version} / ${build.versionName}`)
exigir(build.versionName === release.versionName, "Build e release mantêm o mesmo versionName", build.versionName)
exigir(build.versionCode > release.versionCode, "Build preparada é mais nova que a publicada", `${build.versionCode} > ${release.versionCode}`)
exigir(appRelease.includes(`APP_DISPLAY_VERSION = \"${build.versionName}\"`), "Versão exibida pelo servidor está alinhada", build.versionName)

console.log("\n[2/6] Atualização instantânea e reconexão")
exigir(Boolean(pkg.dependencies?.["@capacitor/network"]), "Plugin nativo de rede está instalado")
exigir(updater.includes("networkStatusChange"), "Atualizador reage ao retorno da internet nativamente")
exigir(updater.includes("appStateChange"), "Atualizador revalida ao voltar para o aplicativo")
exigir(updater.includes("INTERVALO_VERIFICACAO"), "Atualizador verifica nova release enquanto o app permanece aberto")
exigir(sync.includes("@capacitor/network"), "Sincronização geral usa estado de rede nativo")
exigir(sync.includes("appStateChange"), "Sincronização geral é retomada ao retornar ao app")

console.log("\n[3/6] Segurança da APK")
exigir(updaterNativo.includes("getPackageArchiveInfo"), "APK é validada pelo PackageManager")
exigir(updaterNativo.includes("getContext().getPackageName().equals(candidato.packageName)"), "APK precisa pertencer ao mesmo applicationId")
exigir(updaterNativo.includes("versaoCandidata <= versaoInstalada"), "APK precisa ter versionCode superior")
exigir(updaterNativo.includes("assinaturaInstalada.equals(assinaturaCandidata)"), "Assinatura da APK é comparada com a instalação atual")
exigir(networkSecurity.includes('cleartextTrafficPermitted="false"'), "Android bloqueia tráfego HTTP inseguro")

console.log("\n[4/6] Menus/submenus Android")
exigir(mainActivity.includes("setHandleNativeActionModesEnabled(false)"), "ActionMode permanece sob controle nativo do Android")
const atributosProibidos = ["actionModeTheme", "actionModeBackground", "actionMenuTextColor", "colorBackgroundFloating", "android:background"]
for (const atributo of atributosProibidos) {
  exigir(!styles.includes(atributo), `Tema nativo não força ${atributo}`)
}

console.log("\n[5/6] Recuperação de interface")
exigir(existe("app/error.tsx"), "Boundary de erro da aplicação existe")
exigir(existe("app/global-error.tsx"), "Boundary global evita tela branca irrecuperável")
exigir(existe("app/area-restrita/error.tsx"), "Área Restrita possui recuperação própria")
exigir(existe("app/loading.tsx"), "Aplicação possui estado global de carregamento")

console.log("\n[6/6] Inventário quadro por quadro")
const arquivosApp = listarArquivos("app")
const paginas = arquivosApp.filter((arquivo) => arquivo.endsWith("/page.tsx") || arquivo === "app/page.tsx")
const apis = arquivosApp.filter((arquivo) => arquivo.endsWith("/route.ts"))
const boundaries = arquivosApp.filter((arquivo) => arquivo.endsWith("/error.tsx") || arquivo.endsWith("/global-error.tsx"))
ok("Telas/páginas encontradas", String(paginas.length))
ok("Rotas de API encontradas", String(apis.length))
ok("Boundaries de erro encontrados", String(boundaries.length))

const mobilePolish = ler("components/mobile-polish-runtime.tsx")
if (/area-restrita-shell[^`]*select/s.test(mobilePolish)) aviso("Selects web ainda recebem aparência do shell", "revisar individualmente durante a auditoria visual; opções nativas continuam sob controle Android")

const rateLimit = ler("lib/rate-limit.ts")
if (rateLimit.includes("new Map")) aviso("Rate limit é local ao processo", "adequado à escala atual, mas deve migrar para armazenamento compartilhado antes de múltiplas réplicas")

const recarregamentos = [...listarArquivos("components"), ...arquivosApp]
  .filter((arquivo) => /\.(ts|tsx)$/.test(arquivo))
  .filter((arquivo) => ler(arquivo).includes("window.location.reload()"))
if (recarregamentos.length) aviso("Há recarregamentos completos intencionais", recarregamentos.join(", "))

console.log(`\nResultado: ${falhas} falha(s) crítica(s), ${avisos} aviso(s).`)
if (falhas > 0) process.exit(1)
console.log("Auditoria crítica aprovada. Avisos permanecem no roteiro de robustez para revisão tela por tela.\n")
