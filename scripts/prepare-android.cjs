const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
const android = path.join(raiz, "android")
const appGradle = path.join(android, "app", "build.gradle")
const variablesGradle = path.join(android, "variables.gradle")
const origemRecursos = path.join(raiz, "native-assets", "android", "res")
const destinoRecursos = path.join(android, "app", "src", "main", "res")
const origemJava = path.join(raiz, "native-assets", "android", "src", "main", "java")
const destinoJava = path.join(android, "app", "src", "main", "java")
const manifestPath = path.join(android, "app", "src", "main", "AndroidManifest.xml")
const origemLiturgiaOffline = path.join(raiz, "public", "offline", "liturgia-completa")
const destinoLiturgiaOffline = path.join(android, "app", "src", "main", "assets", "public", "offline", "liturgia-completa")

if (!fs.existsSync(appGradle)) throw new Error("Projeto Android ausente. Execute npm run android:add primeiro.")

const versionCode = Number(process.env.APP_VERSION_CODE || 1)
const versionName = String(process.env.APP_VERSION_NAME || require("../package.json").version)
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("APP_VERSION_CODE deve ser um inteiro positivo.")

let app = fs.readFileSync(appGradle, "utf8")
app = app.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
app = app.replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`)
fs.writeFileSync(appGradle, app)

if (fs.existsSync(variablesGradle)) {
  let variables = fs.readFileSync(variablesGradle, "utf8")
  variables = variables.replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  variables = variables.replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36")
  fs.writeFileSync(variablesGradle, variables)
}

if (!fs.existsSync(origemRecursos)) throw new Error("Recursos Android personalizados ausentes.")
fs.cpSync(origemRecursos, destinoRecursos, { recursive: true, force: true })
if (!fs.existsSync(origemJava)) throw new Error("Código nativo Android personalizado ausente.")
fs.cpSync(origemJava, destinoJava, { recursive: true, force: true })
if (!fs.existsSync(origemLiturgiaOffline)) throw new Error("Pacote anual da Liturgia offline ausente.")
fs.mkdirSync(destinoLiturgiaOffline, { recursive: true })
fs.cpSync(origemLiturgiaOffline, destinoLiturgiaOffline, { recursive: true, force: true })

const splashPersonalizada = path.join(origemRecursos, "drawable", "splash.png")
for (const pasta of fs.readdirSync(destinoRecursos, { withFileTypes: true })) {
  if (pasta.isDirectory() && pasta.name.startsWith("drawable-") && fs.existsSync(path.join(destinoRecursos, pasta.name, "splash.png"))) {
    fs.copyFileSync(splashPersonalizada, path.join(destinoRecursos, pasta.name, "splash.png"))
  }
}

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8")
  if (!manifest.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
    manifest = manifest.replace(
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />',
    )
  }
  if (!manifest.includes("android.permission.POST_NOTIFICATIONS")) {
    manifest = manifest.replace(
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    )
  }
  manifest = manifest.replace(/android:allowBackup="[^"]+"/, 'android:allowBackup="false"')
  if (!manifest.includes("android:usesCleartextTraffic")) {
    manifest = manifest.replace(
      'android:allowBackup="false"',
      'android:allowBackup="false"\n        android:usesCleartextTraffic="false"\n        android:networkSecurityConfig="@xml/network_security_config"\n        android:hardwareAccelerated="true"\n        android:enableOnBackInvokedCallback="true"',
    )
  }
  if (!manifest.includes("android:windowSoftInputMode")) {
    manifest = manifest.replace(
      'android:exported="true">',
      'android:exported="true"\n            android:resizeableActivity="true"\n            android:windowSoftInputMode="adjustResize">',
    )
  }
  if (!manifest.includes('android:name=".CaminhoDaLuzActivity"')) {
    manifest = manifest.replace(
      "</application>",
      '        <activity\n            android:name=".CaminhoDaLuzActivity"\n            android:exported="false"\n            android:screenOrientation="portrait"\n            android:theme="@style/AppTheme.NoActionBar" />\n    </application>',
    )
  }
  fs.writeFileSync(manifestPath, manifest)
}

console.log(`Android preparado: versionCode ${versionCode}, versionName ${versionName}, targetSdk 36, notificações Android 13+, ícones adaptativos, rede HTTPS, núcleo offline, Liturgia anual e Caminho da Luz local.`)
