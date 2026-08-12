const { spawnSync } = require("node:child_process")

const env = { ...process.env }
for (const key of [
  "INITIAL_ADMIN_NAME",
  "INITIAL_ADMIN_USERNAME",
  "INITIAL_ADMIN_EMAIL",
  "INITIAL_ADMIN_PASSWORD",
  "INITIAL_ADMIN2_NAME",
  "INITIAL_ADMIN2_USERNAME",
  "INITIAL_ADMIN2_EMAIL",
  "INITIAL_ADMIN2_PASSWORD",
]) {
  delete env[key]
}

env.SANTA_LUZIA_BUILD = "1"

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
