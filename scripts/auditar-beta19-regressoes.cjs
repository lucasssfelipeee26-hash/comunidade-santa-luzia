const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
function ok(condition, message) { if (!condition) { console.error(`✗ ${message}`); process.exitCode = 1 } else console.log(`✓ ${message}`) }

const config = JSON.parse(read("config/android-motion-beta.json"))
ok(config.versionName === "2.0.0-beta.19" && config.versionCode === 20019, "identidade Motion Beta 19/code20019")
ok(config.applicationId === "br.com.comunidadesantaluzia.motionbeta", "applicationId Motion preservado")

const home = read("app/visitante/page.tsx")
const atalhos = [...home.matchAll(/id:\s*"(centro-liturgico|escala-dia|biblioteca|liturgia-diaria)"/g)].map((m) => m[1])
ok(atalhos.length === 4 && new Set(atalhos).size === 4, "Home React possui exatamente quatro atalhos públicos")
ok((home.match(/title:\s*"Liturgia Diária"/g) || []).length === 1, "Liturgia Diária não está duplicada na fonte React")
ok(home.includes('data-original-home-icon="true"'), "ícones originais dos atalhos continuam presentes")

const regression = read("public/motion/android-beta19-regression-fix.js")
ok(regression.includes('[data-sl-home-generated-fourth="true"]{display:none!important}'), "atalho legado gerado pelo runtime é bloqueado")
ok(regression.includes('.sl-home-runtime-icon{display:none!important}'), "ícone duplicado gerado pelo runtime é bloqueado")
ok(regression.includes('data-original-home-icon'), "ícones originais são compactados sem substituição")

const hero = read("components/hero.tsx")
ok(hero.includes('aspect-[90/31]'), "hero móvel usa a proporção real da imagem 1800x620")
ok(hero.includes('object-cover object-center'), "hero não deixa faixas vazias")
ok(hero.includes('data-hero-mobile-framed="true"'), "hero corrigido possui marcador de auditoria")

const biblioteca = read("app/biblioteca/page.tsx")
ok(biblioteca.includes('data-biblioteca-beta19="compacta"'), "Biblioteca usa modo compacto")
ok(biblioteca.includes('section:first-child{display:none!important}'), "banner promocional superior da Biblioteca é removido")

const offline = read("scripts/patch-beta19-offline-pack.cjs")
ok(offline.includes('androidAssetTransport = "binary-v1"'), "acervo offline usa transporte binário local")
ok(offline.includes('oficio-01.html.json.bin') && offline.includes('oficio-10.html.json.bin'), "Liturgia das Horas inteira é empacotada no APK")
ok(offline.includes('zlib.gunzipSync'), "pacotes litúrgicos são validados antes do APK")

const acervo = read("components/acervo-liturgico-offline.tsx")
ok(acervo.includes('const BASE="/offline/iliturgia"'), "Centro Litúrgico aponta para o acervo interno")
ok(acervo.includes('DecompressionStream("gzip")'), "Centro Litúrgico descompacta os pacotes localmente")

const cap = read("capacitor.config.ts")
ok(cap.includes('if (!motionBeta && valorServidor)'), "Motion Beta continua sem server.url")
const main = read("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java")
ok(main.includes("OfflineStorePlugin.class") && main.includes("SyncHttpPlugin.class"), "SQLite/offline e sincronização nativa preservados")

const deep = read("android-web/motion/android-deep-auditor-beta16.js")
ok(deep.includes("SantaLuziaDeepAudit") && deep.includes("profile-dialog-collapsed"), "Deep Scan da auditoria completa preservado")
const windows = read("config/android-motion-beta.json")
ok(windows.includes("a548eebe6506aac2de3efa3ab5540d935b4cad85788f963469ebf7a75d20c637"), "runtime histórico de animações permanece fixado")

if (process.exitCode) process.exit(process.exitCode)
console.log("Beta 19 aprovada contra as regressões observadas nas imagens/vídeo, mantendo a auditoria anterior como base.")
