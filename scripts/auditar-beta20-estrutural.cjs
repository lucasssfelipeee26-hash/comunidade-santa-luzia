const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")
const exists = (rel) => fs.existsSync(path.join(root, rel))
function ok(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`)
    process.exitCode = 1
  } else console.log(`✓ ${message}`)
}

const config = JSON.parse(read("config/android-motion-beta.json"))
const stable = JSON.parse(read("config/android-build.json"))
ok(config.versionName === "2.0.0-beta.20" && config.versionCode === 20020, "identidade Motion Beta 20/code20020")
ok(config.applicationId === "br.com.comunidadesantaluzia.motionbeta", "package Beta isolado")
ok(stable.versionName === "1.0.6" && stable.versionCode === 18, "canal oficial permanece congelado")

const home = read("app/visitante/page.tsx")
const shortcuts = [...home.matchAll(/id:\s*"(centro-liturgico|escala-dia|biblioteca|liturgia-diaria)"/g)].map((m) => m[1])
ok(shortcuts.length === 4 && new Set(shortcuts).size === 4, "Home tem exatamente quatro atalhos públicos")
ok((home.match(/title:\s*"Liturgia Diária"/g) || []).length === 1, "Liturgia Diária não está duplicada na fonte")
ok(home.includes('data-original-home-icon="true"'), "ícones originais preservados")

const regression = read("public/motion/android-beta19-regression-fix.js")
ok(regression.includes('[data-sl-home-generated-fourth="true"]{display:none!important}'), "card legado duplicado bloqueado")
ok(regression.includes('.sl-home-runtime-icon{display:none!important}'), "ícones legados duplicados bloqueados")
ok(regression.includes('@media (max-width:639px)'), "cards compactados no telefone")

const hero = read("components/hero.tsx")
ok(hero.includes('aspect-[90/31]'), "hero usa proporção 1800x620")
ok(hero.includes('object-cover object-center'), "hero preenche o quadro sem faixas vazias")
ok(hero.includes('data-hero-mobile-framed="true"'), "hero possui trava de regressão")

const biblioteca = read("components/biblioteca-catolica.tsx")
const bibliotecaPage = read("app/biblioteca/page.tsx")
ok(!biblioteca.includes("Acervo para estudo e formação"), "banner promocional da Biblioteca removido na origem")
ok(biblioteca.includes('data-biblioteca-catalogo="beta20"'), "Biblioteca abre diretamente no catálogo")
ok(!bibliotecaPage.includes("section:first-child{display:none"), "Biblioteca não depende mais de CSS ocultando conteúdo")

const offlinePatch = read("scripts/patch-beta19-offline-pack.cjs")
ok(offlinePatch.includes('androidAssetTransport = "binary-v1"'), "iLiturgia usa transporte binário local")
ok(offlinePatch.includes("zlib.gunzipSync") && offlinePatch.includes("JSON.parse"), "pacotes iLiturgia são validados antes do APK")
ok(offlinePatch.includes("config.versionName"), "manifesto iLiturgia acompanha a versão da Beta")
const acervo = read("components/acervo-liturgico-offline.tsx")
ok(acervo.includes('const BASE="/offline/iliturgia"'), "Centro Litúrgico lê acervo interno")
ok(acervo.includes('DecompressionStream("gzip")'), "Centro Litúrgico abre os pacotes localmente")

const login = read("components/login-form.tsx")
const store = read("lib/store.tsx")
const nativeFetch = read("android-web/motion/android-native-fetch-beta10.js")
const sync = read("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/SyncHttpPlugin.java")
ok(login.includes("router.replace") && login.includes("router.refresh()"), "retorno de login compatível com a navegação local")
ok(store.includes('fetch("/api/auth/login"') && store.includes('globalMutate("/api/auth/me")'), "sessão é atualizada após autenticação")
ok(nativeFetch.includes("SyncHttp") && nativeFetch.includes("/api/"), "requisições de autenticação/sincronização passam pela ponte nativa")
ok(sync.includes("CookieManager") && sync.includes("set-cookie") && sync.includes("BASE_URL"), "cookies de sessão são preservados pela ponte nativa")

const updater = read("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/AppUpdaterPlugin.java")
ok(updater.includes('call.getString("expectedSha256"'), "atualizador exige SHA-256 publicado")
ok(updater.includes("getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)"), "APK de atualização fica em armazenamento externo privado do app")
ok(updater.includes("MessageDigest.isEqual"), "hash recebido é comparado antes da instalação")
ok(updater.includes("assinaturaInstalada.equals(assinaturaCandidata)"), "assinatura do APK é validada contra a instalada")

const bundle = read("scripts/bundle-motion-beta20.cjs")
ok(bundle.includes("android-motion-runtime-beta20.js"), "stack Motion será consolidada em um único runtime")
ok(bundle.includes("document.currentScript"), "consolidação bloqueia scripts incompatíveis")
const prepare = read("scripts/prepare-motion-beta20.cjs")
for (const marker of ["debuggable false", "minifyEnabled true", "shrinkResources true", 'android:launchMode="singleTop"', "cordova.js", "cordova_plugins.js", "_franciscoxavier.jpg", "capConfig.appId = config.applicationId"]) {
  ok(prepare.includes(marker), `trava estrutural presente: ${marker}`)
}

ok(!exists("cordova_plugins.js") || !read("cordova_plugins.js").trim(), "nenhum código Cordova ativo no fonte raiz")

if (process.exitCode) process.exit(process.exitCode)
console.log("Beta 20 aprovada na auditoria estática das regressões visuais, iLiturgia, login/sincronização e achados estruturais da Beta 18.")
