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
  return source.includes("LocalNotificationsPlugin") && source.includes("checkPermissions") && source.includes("requestPermissions")
})

if (!pluginFile) {
  const listing = candidates.map((file) => path.relative(root, file)).join(", ") || "nenhum candidato"
  fail(`Código-fonte do LocalNotificationsPlugin não encontrado. Candidatos: ${listing}`)
}

let source = fs.readFileSync(pluginFile, "utf8")
const isKotlin = pluginFile.endsWith(".kt")
console.log(`[motion-beta21-notifications] Fonte localizada em ${path.relative(root, pluginFile)} (${isKotlin ? "Kotlin" : "Java"})`)

// 1) checkPermissions: não usa a camada genérica de aliases do Capacitor.
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

// 2) Toda consulta de estado de LocalNotifications passa pelo NotificationManager,
// evitando getPermissionState/getPermissionStates, que também participa do defeito.
source = source
  .replace(/getPermissionState\(LOCAL_NOTIFICATIONS\)\s*==\s*PermissionState\.GRANTED/g, "manager.areNotificationsEnabled()")
  .replace(/getPermissionState\(LOCAL_NOTIFICATIONS\)\s*!=\s*PermissionState\.GRANTED/g, "!manager.areNotificationsEnabled()")

// 3) requestPermissions: o crash confirmado ocorre em requestPermissionForAlias ->
// requestPermissionForAliases. Na Beta 21 fazemos a solicitação Android diretamente,
// fora do mecanismo de aliases, e resolvemos a chamada sem derrubar o processo.
if (isKotlin) {
  const unsafeRequest = 'requestPermissionForAlias(LOCAL_NOTIFICATIONS, call, "permissionsCallback")'
  if (!source.includes(unsafeRequest)) fail("requestPermissions Kotlin não contém o caminho de alias esperado.")
  const safeRequest = [
    "activity.runOnUiThread {",
    "                try {",
    "                    activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4217)",
    "                } catch (_: Exception) {",
    "                    // A permissão pode ser habilitada manualmente; nunca derrubar o aplicativo.",
    "                }",
    "            }",
    "            val permissionsResultJSON = JSObject()",
    '            permissionsResultJSON.put("display", "prompt")',
    "            call.resolve(permissionsResultJSON)",
  ].join("\n")
  source = source.replace(unsafeRequest, safeRequest)

  // 4) schedule/update de 8.3.x também tentam solicitar a mesma permissão por alias.
  // Se ainda não houver permissão, falham de forma controlada; após a concessão,
  // o agendamento continua pelo caminho normal.
  for (const callbackName of ["scheduleAfterPermission", "updateAfterPermission"]) {
    const unsafe = `requestPermissionForAlias(LOCAL_NOTIFICATIONS, call, "${callbackName}")`
    if (!source.includes(unsafe)) fail(`Caminho ${callbackName} não encontrado; implementação mudou.`)
    source = source.replace(unsafe, "LocalNotificationsError.NOTIFICATIONS_DISABLED.reject(call)")
  }
} else {
  const unsafeRequest = 'requestPermissionForAlias(LOCAL_NOTIFICATIONS, call, "permissionsCallback");'
  if (!source.includes(unsafeRequest)) fail("requestPermissions Java não contém o caminho de alias esperado.")
  const safeRequest = [
    "getActivity().runOnUiThread(() -> {",
    "                try {",
    "                    getActivity().requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4217);",
    "                } catch (Exception ignored) {}",
    "            });",
    "            JSObject permissionsResultJSON = new JSObject();",
    '            permissionsResultJSON.put("display", "prompt");',
    "            call.resolve(permissionsResultJSON);",
  ].join("\n")
  source = source.replace(unsafeRequest, safeRequest)

  for (const callbackName of ["scheduleAfterPermission", "updateAfterPermission"]) {
    const unsafe = `requestPermissionForAlias(LOCAL_NOTIFICATIONS, call, "${callbackName}");`
    if (source.includes(unsafe)) source = source.replace(unsafe, "LocalNotificationsError.NOTIFICATIONS_DISABLED.reject(call);")
  }
}

fs.writeFileSync(pluginFile, source)

const patched = fs.readFileSync(pluginFile, "utf8")
if (/super\.checkPermissions\(call\);?/.test(patched)) fail("checkPermissions genérico permaneceu após o patch.")
if (!patched.includes('permissionsResultJSON.put("display", getNotificationPermissionText())')) fail("Implementação segura de checkPermissions não foi aplicada.")
if (/getPermissionState\(LOCAL_NOTIFICATIONS\)/.test(patched)) fail("Consulta genérica getPermissionState(LocalNotifications) permaneceu após o patch.")
if (/requestPermissionForAlias\(LOCAL_NOTIFICATIONS/.test(patched)) fail("Solicitação genérica por alias permaneceu após o patch.")
if (!patched.includes("POST_NOTIFICATIONS") || !patched.includes("4217")) fail("Solicitação Android direta de POST_NOTIFICATIONS não foi aplicada.")

console.log("[motion-beta21-notifications] Crashfix profundo aplicado: check/request/schedule/update não usam mais o caminho genérico de aliases que gerou NullPointerException em CapacitorPlugins.")
