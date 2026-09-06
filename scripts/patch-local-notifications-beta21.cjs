const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const packageRoot = path.join(root, "node_modules", "@capacitor", "local-notifications")

function fail(message) {
  console.error(`[motion-beta21-notifications] ${message}`)
  process.exit(1)
}

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, found)
    else if (entry.isFile() && /LocalNotificationsPlugin\.(java|kt)$/.test(entry.name)) found.push(absolute)
  }
  return found
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") {
  fail("Patch permitido somente na Motion Beta.")
}

if (!fs.existsSync(packageRoot)) {
  fail("Pacote @capacitor/local-notifications não está instalado.")
}

const candidates = walk(packageRoot)
const pluginFile = candidates.find((file) => {
  const source = fs.readFileSync(file, "utf8")
  return source.includes("LocalNotificationsPlugin") && source.includes("checkPermissions")
})

if (!pluginFile) {
  const listing = candidates.map((file) => path.relative(root, file)).join(", ") || "nenhum candidato"
  fail(`Código-fonte do LocalNotificationsPlugin não encontrado. Candidatos: ${listing}`)
}

let source = fs.readFileSync(pluginFile, "utf8")
const isKotlin = pluginFile.endsWith(".kt")
console.log(`[motion-beta21-notifications] Fonte localizada em ${path.relative(root, pluginFile)} (${isKotlin ? "Kotlin" : "Java"})`)

const unsafeCheck = /super\.checkPermissions\(call\);?/
if (!unsafeCheck.test(source)) {
  const pos = source.indexOf("checkPermissions")
  const excerpt = pos >= 0 ? source.slice(Math.max(0, pos - 500), pos + 1400) : source.slice(0, 1800)
  console.error("[motion-beta21-notifications] Trecho de checkPermissions encontrado para diagnóstico:\n" + excerpt)
  fail("Chamada genérica super.checkPermissions(call) não encontrada; implementação mudou.")
}

const safeCheck = isKotlin
  ? [
      "val permissionsResultJSON = JSObject()",
      '            permissionsResultJSON.put("display", getNotificationPermissionText())',
      "            call.resolve(permissionsResultJSON)",
    ].join("\n")
  : [
      "JSObject permissionsResultJSON = new JSObject();",
      '            permissionsResultJSON.put("display", getNotificationPermissionText());',
      "            call.resolve(permissionsResultJSON);",
    ].join("\n")

source = source.replace(unsafeCheck, safeCheck)

const unsafeRequestState = /getPermissionState\(LOCAL_NOTIFICATIONS\)\s*==\s*PermissionState\.GRANTED/
if (unsafeRequestState.test(source)) {
  source = source.replace(unsafeRequestState, "manager.areNotificationsEnabled()")
}

fs.writeFileSync(pluginFile, source)

const patched = fs.readFileSync(pluginFile, "utf8")
if (/super\.checkPermissions\(call\);?/.test(patched)) {
  fail("checkPermissions genérico permaneceu após o patch.")
}
if (!patched.includes('permissionsResultJSON.put("display", getNotificationPermissionText())')) {
  fail("Implementação segura de checkPermissions não foi aplicada.")
}

console.log("[motion-beta21-notifications] Workaround aplicado: checkPermissions consulta diretamente o estado das notificações e evita o caminho do Capacitor que causou NullPointerException no aparelho.")
