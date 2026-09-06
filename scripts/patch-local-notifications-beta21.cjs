const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const pluginFile = path.join(
  root,
  "node_modules",
  "@capacitor",
  "local-notifications",
  "android",
  "src",
  "main",
  "java",
  "com",
  "capacitorjs",
  "plugins",
  "localnotifications",
  "LocalNotificationsPlugin.java",
)

function fail(message) {
  console.error(`[motion-beta21-notifications] ${message}`)
  process.exit(1)
}

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") {
  fail("Patch permitido somente na Motion Beta.")
}

if (!fs.existsSync(pluginFile)) {
  fail(`Plugin LocalNotifications ausente: ${path.relative(root, pluginFile)}`)
}

let source = fs.readFileSync(pluginFile, "utf8")

const unsafeCheck = "            super.checkPermissions(call);"
const safeCheck = [
  "            JSObject permissionsResultJSON = new JSObject();",
  "            permissionsResultJSON.put(\"display\", getNotificationPermissionText());",
  "            call.resolve(permissionsResultJSON);",
].join("\n")

if (!source.includes(unsafeCheck)) {
  fail("Trecho inseguro de checkPermissions não encontrado; versão do plugin mudou.")
}
source = source.replace(unsafeCheck, safeCheck)

const unsafeRequestState = "getPermissionState(LOCAL_NOTIFICATIONS) == PermissionState.GRANTED"
if (!source.includes(unsafeRequestState)) {
  fail("Trecho inseguro de requestPermissions não encontrado; versão do plugin mudou.")
}
source = source.replace(unsafeRequestState, "manager.areNotificationsEnabled()")

fs.writeFileSync(pluginFile, source)

const patched = fs.readFileSync(pluginFile, "utf8")
if (patched.includes("super.checkPermissions(call);")) {
  fail("checkPermissions genérico permaneceu após o patch.")
}
if (patched.includes(unsafeRequestState)) {
  fail("getPermissionState inseguro permaneceu após o patch.")
}
if (!patched.includes('permissionsResultJSON.put("display", getNotificationPermissionText());')) {
  fail("Implementação segura de checkPermissions não foi aplicada.")
}
if (!patched.includes("manager.areNotificationsEnabled()")) {
  fail("Verificação segura de permissões não foi aplicada.")
}

console.log("[motion-beta21-notifications] Workaround aplicado: checkPermissions usa o estado direto do NotificationManager e evita o crash do Capacitor em Android 16/Samsung.")
