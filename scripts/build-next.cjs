const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const env = { ...process.env }
for (const key of [
  "INITIAL_ADMIN_NAME",
  "INITIAL_ADMIN_USERNAME",
  "INITIAL_ADMIN_EMAIL",
  "INITIAL_ADMIN_PASSWORD",
]) {
  delete env[key]
}

env.SANTA_LUZIA_BUILD = "1"

function executar(script) {
  const resultado = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", script)], { stdio: "inherit", env })
  if (resultado.error) { console.error(resultado.error); process.exit(1) }
  if ((resultado.status ?? 1) !== 0) process.exit(resultado.status ?? 1)
}

const indicePronto = fs.existsSync(path.join(process.cwd(), "public", "offline", "iliturgia", "indice-liturgico-2026.json"))
const liturgiaCompletaPronta = fs.existsSync(path.join(process.cwd(), "public", "offline", "liturgia-completa", "2026-12.json"))
if (!indicePronto || process.env.REGERAR_LITURGIA_OFFLINE === "1") executar("gerar-indice-liturgico-2026.cjs")
if (!liturgiaCompletaPronta || process.env.REGERAR_LITURGIA_OFFLINE === "1") executar("gerar-liturgia-completa-2026.cjs")
executar("auditar-indice-liturgico-2026.cjs")
executar("auditar-liturgia-completa-2026.cjs")
executar("materializar-apk-android.cjs")

const nextBin = require.resolve("next/dist/bin/next")
const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
  stdio: "inherit",
  env,
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
