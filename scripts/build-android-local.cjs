const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")
const esbuild = require("esbuild")

const root = path.resolve(__dirname, "..")
const out = path.join(root, "android-web")
const nextStatic = path.join(root, ".next", "static")
const publicDir = path.join(root, "public")

function fail(message) { console.error(`[android-local] ${message}`); process.exit(1) }
function ensure(file, label = file) { if (!fs.existsSync(file)) fail(`Ausente: ${label}`) }
function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}
function copyTree(source, target) {
  if (!fs.existsSync(source)) return
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) copyTree(from, to)
    else fs.copyFileSync(from, to)
  }
}
function prepareAndroidILiturgia(dir) {
  const manifestFile = path.join(dir, "iliturgia", "manifest.json")
  if (!fs.existsSync(manifestFile)) fail("Manifesto iLiturgia offline ausente no pacote Android.")

  let manifest
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) }
  catch (error) { fail(`Manifesto iLiturgia inválido: ${error instanceof Error ? error.message : String(error)}`) }

  const iliturgiaDir = path.dirname(manifestFile)
  const geralFile = path.join(iliturgiaDir, "gerais.html.json.gz")
  ensure(geralFile, "fonte íntegra gerais.html.json.gz do iLiturgia")
  try {
    const pacoteGeral = JSON.parse(zlib.gunzipSync(fs.readFileSync(geralFile)).toString("utf8"))
    if (!Array.isArray(pacoteGeral?.documents) || pacoteGeral.documents.length < 450) {
      fail(`Fonte geral do iLiturgia incompleta (${pacoteGeral?.documents?.length || 0} documentos).`)
    }
    console.log(`[android-local] fonte iLiturgia geral validada: ${pacoteGeral.documents.length} documentos.`)
  } catch (error) {
    fail(`Fonte geral do iLiturgia inválida: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Os 12 pacotes públicos evangelhos-XX foram gerados separadamente e alguns
  // chegaram corrompidos ao repositório. O acervo geral íntegro já contém esse
  // conjunto de documentos (a auditoria histórica contabiliza 475 entradas).
  // Na Beta Android usamos essa fonte íntegra uma única vez, sem duplicar dados.
  const evangelho = Array.isArray(manifest.categorias) ? manifest.categorias.find((c) => c?.id === "evangelho") : null
  if (!evangelho) fail("Categoria evangelho ausente no manifesto iLiturgia.")
  evangelho.arquivos = ["gerais.html.json.gz"]
  evangelho.androidFonteIntegra = "gerais.html.json.gz"
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

  for (const file of fs.readdirSync(iliturgiaDir)) {
    if (/^evangelhos-\d{2}\.html\.json\.gz$/i.test(file)) fs.rmSync(path.join(iliturgiaDir, file), { force: true })
  }

  const gzipFiles = walk(dir).filter((file) => file.toLowerCase().endsWith(".gz"))
  const invalid = []
  for (const file of gzipFiles) {
    const rel = path.relative(out, file).split(path.sep).join("/")
    try {
      const source = fs.readFileSync(file)
      const decoded = zlib.gunzipSync(source)
      const normalized = zlib.gzipSync(decoded, { level: 9, mtime: 0 })
      zlib.gunzipSync(normalized)
      fs.writeFileSync(file, normalized)
      console.log(`[android-local] gzip validado: ${rel} (${source.length} -> ${normalized.length} bytes)`)
    } catch (error) {
      invalid.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (invalid.length) fail(`GZIP offline inválido após saneamento:\n- ${invalid.join("\n- ")}`)
  console.log(`[android-local] ${gzipFiles.length} arquivo(s) GZIP offline validado(s)/normalizado(s); Evangelhos Android ligados à fonte geral íntegra.`)
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") fail("SANTA_LUZIA_MOTION_BETA=1 é obrigatório.")
ensure(path.join(root, "android-local", "entry.tsx"), "entry React local")
ensure(nextStatic, ".next/static — execute npm run build antes")
for (const name of ["android-native-fetch-beta10.js", "android-local-first-beta8.js", "android-member-state-beta8.js", "android-domain-bridge-beta10.js", "android-quiz-offline-beta10.js", "android-local-navigation-beta10.js", "android-original-ui-beta10.js"]) ensure(path.join(out, "motion", name), `motion/${name}`)

fs.mkdirSync(out, { recursive: true })
copyTree(publicDir, out)
prepareAndroidILiturgia(path.join(out, "offline"))
copyTree(nextStatic, path.join(out, "_next", "static"))

const alias = {
  "next/link": path.join(root, "android-local", "shims", "next-link.tsx"),
  "next/navigation": path.join(root, "android-local", "shims", "next-navigation.ts"),
  "next/image": path.join(root, "android-local", "shims", "next-image.tsx"),
}

esbuild.buildSync({
  entryPoints: [path.join(root, "android-local", "entry.tsx")],
  outfile: path.join(out, "local-app.js"),
  bundle: true,
  minify: true,
  sourcemap: false,
  platform: "browser",
  format: "iife",
  target: ["chrome120"],
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  alias,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify("https://comunidade-santa-luzia-production.up.railway.app"),
  },
  logLevel: "info",
})

const cssFiles = walk(nextStatic).filter((file) => file.endsWith(".css"))
if (!cssFiles.length) fail("Next não produziu CSS; interface original não pode ser empacotada.")
const cssLinks = cssFiles.map((file) => {
  const rel = path.relative(nextStatic, file).split(path.sep).join("/")
  return `    <link rel="stylesheet" href="/_next/static/${rel}" />`
}).join("\n")

// Ordem obrigatória: base nativa -> fila genérica -> estado de membros ->
// regras de domínio -> quiz local -> navegação local -> aquecimento -> React.
const requiredScripts = [
  "windows-behavior-fixes.js",
  "windows-beta7-polish.js",
  "windows-preload-v5.js",
  "windows-beta-runtime.js",
  "android-motion-beta.js",
  "android-native-fetch-beta10.js",
  "android-local-first-beta8.js",
  "android-member-state-beta8.js",
  "android-domain-bridge-beta10.js",
  "android-quiz-offline-beta10.js",
  "android-local-navigation-beta10.js",
  "android-original-ui-beta10.js",
]
for (const file of requiredScripts) ensure(path.join(out, "motion", file), `motion/${file}`)
const scriptTags = requiredScripts.map((file) => `    <script defer src="/motion/${file}"></script>`).join("\n")

const html = `<!doctype html>
<html lang="pt-BR" data-site-theme="manto-rubi" data-native-platform="android">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no" />
    <meta name="theme-color" content="#7b1326" />
    <meta name="color-scheme" content="light" />
    <title>Santa Luzia</title>
${cssLinks}
    <link rel="stylesheet" href="/motion/windows-motion-fixes.css" />
    <style>
      html,body,#root{min-height:100%;margin:0}body{background:#fff8ee}
      #sl-boot{min-height:100vh;display:grid;place-items:center;padding:24px;color:#7b1326;background:#fff8ee;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      #sl-boot>div{text-align:center}.sl-seal{width:76px;height:76px;margin:auto;display:grid;place-items:center;border-radius:999px;border:2px solid #d4af37;background:#fff;font-family:Georgia,serif;font-size:28px;font-weight:700}.sl-name{margin:16px 0 4px;font-family:Georgia,serif;font-size:26px}.sl-sub{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#705e52}
    </style>
${scriptTags}
    <script defer src="/local-app.js"></script>
  </head>
  <body class="app-mobile-shell font-sans antialiased">
    <div id="root"><div id="sl-boot"><div><div class="sl-seal">SL</div><div class="sl-name">SANTA LUZIA</div><div class="sl-sub">Acólitos e Coroinhas São Padre Pio</div></div></div></div>
  </body>
</html>
`
fs.writeFileSync(path.join(out, "index.html"), html)

const entryText = fs.readFileSync(path.join(root, "android-local", "entry.tsx"), "utf8")
const mandatory = ["MembroDashboard", "ModeradorDashboard", "CentralAtrasos", "FormacaoMembros", "RankingInterativo", "ModeradorEscalaPage", "ModeradorFormacaoPage", "ModeradorPresencasPage", "NovoRegistroModerador", "GerenciadorRanking", "GerenciadorTema", "ImportarAcervoLiturgico", "PerfisEquipe", "PerfilModerador", "MobileBottomNav"]
for (const marker of mandatory) if (!entryText.includes(marker)) fail(`Rota/componente original obrigatório ausente: ${marker}`)
const outputJs = fs.readFileSync(path.join(out, "local-app.js"), "utf8")
if (outputJs.length < 250_000) fail(`Bundle local parece incompleto (${outputJs.length} bytes).`)
if (/offline\.html|offline-bridge\.html/.test(html)) fail("Interface paralela offline reapareceu no HTML local.")
for (const marker of ["android-native-fetch-beta10.js", "android-domain-bridge-beta10.js", "android-quiz-offline-beta10.js", "android-local-navigation-beta10.js", "/local-app.js"]) if (!html.includes(marker)) fail(`HTML local sem camada: ${marker}`)
console.log(`[android-local] Interface original empacotada: ${outputJs.length} bytes JS, ${cssFiles.length} CSS Next, ${mandatory.length} módulos obrigatórios.`)
