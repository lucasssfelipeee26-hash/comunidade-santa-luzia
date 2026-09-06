const fs = require('node:fs')
const path = require('node:path')

if (process.env.SANTA_LUZIA_MOTION_BETA !== '1') {
  console.log('Deep crash recorder: ignorado fora da Motion Beta.')
  process.exit(0)
}

const root = path.resolve(__dirname, '..')
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
const appClassPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'br', 'com', 'comunidadesantaluzia', 'app', 'SantaLuziaApplication.java')
const diagnosticsPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'br', 'com', 'comunidadesantaluzia', 'app', 'DeepDiagnosticsPlugin.java')

for (const file of [manifestPath, appClassPath, diagnosticsPath]) {
  if (!fs.existsSync(file)) throw new Error(`Deep crash recorder: arquivo ausente: ${file}`)
}

let manifest = fs.readFileSync(manifestPath, 'utf8')
if (!/<application\b/.test(manifest)) throw new Error('Deep crash recorder: <application> não encontrado.')

if (/android:name="[^"]+"/.test(manifest.match(/<application\b[\s\S]*?>/)?.[0] || '')) {
  manifest = manifest.replace(/(<application\b[\s\S]*?)android:name="[^"]+"/, '$1android:name=".SantaLuziaApplication"')
} else {
  manifest = manifest.replace(/<application\b/, '<application\n        android:name=".SantaLuziaApplication"')
}

fs.writeFileSync(manifestPath, manifest)

const finalManifest = fs.readFileSync(manifestPath, 'utf8')
if (!finalManifest.includes('android:name=".SantaLuziaApplication"')) {
  throw new Error('Deep crash recorder: Application personalizada não foi aplicada ao manifesto.')
}

const appClass = fs.readFileSync(appClassPath, 'utf8')
for (const marker of ['setDefaultUncaughtExceptionHandler', 'fatal_crashes', 'stackTrace']) {
  if (!appClass.includes(marker)) throw new Error(`Deep crash recorder incompleto: ${marker}`)
}

const diagnostics = fs.readFileSync(diagnosticsPath, 'utf8')
if (!diagnostics.includes('fatalCrashes')) {
  throw new Error('Deep crash recorder: DeepDiagnosticsPlugin ainda não exporta fatalCrashes.')
}

console.log('Motion Beta 21: gravador fatal nativo aplicado antes da Activity/WebView/login.')
