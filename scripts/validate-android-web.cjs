const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const required = {
  splash: path.join(root, "android-web", "index.html"),
  mission: path.join(root, "android-web", "caminho-da-luz", "index.html"),
  motion10: path.join(root, "android-web", "motion", "android-original-ui-beta10.js"),
}

for (const [name, file] of Object.entries(required)) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo Android obrigatório ausente (${name}): ${path.relative(root, file)}`)
}

for (const forbidden of ["offline.html", "offline-bridge.html"]) {
  if (fs.existsSync(path.join(root, "android-web", forbidden))) {
    throw new Error(`Beta 10 não pode conter interface offline paralela: android-web/${forbidden}`)
  }
}

const splash = fs.readFileSync(required.splash, "utf8")
if (!/<!doctype html>/i.test(splash) || !splash.includes("SANTA LUZIA")) throw new Error("Splash local inválido.")
if (/Área Restrita|Gerenciar Formação|Central de Atrasos|Jornada Litúrgica/.test(splash)) {
  throw new Error("index.html local deve ser apenas splash, nunca uma segunda interface do aplicativo.")
}

const motion10 = fs.readFileSync(required.motion10, "utf8")
new vm.Script(motion10, { filename: "android-web/motion/android-original-ui-beta10.js" })
for (const marker of [
  'const VERSION = "2.0.0-beta.10"',
  "/area-restrita/membro",
  "/area-restrita/moderador",
  "/area-restrita/atrasos",
  "/area-restrita/moderador/presencas",
  "/area-restrita/moderador/registro",
  "/api/auth/me",
  "/api/escalas",
  "/api/formacoes",
  "/api/ranking",
  "fullWarm",
  "recoverAuthenticatedOfflineRoute",
]) {
  if (!motion10.includes(marker)) throw new Error(`Runtime Beta 10 sem marcador obrigatório: ${marker}`)
}

const mission = fs.readFileSync(required.mission, "utf8")
if (!mission.includes("<script") || mission.length < 1000) throw new Error("Pacote local da Missão do Altar parece incompleto.")

console.log("Beta 10 validada: nenhuma interface offline paralela; splash + runtime da interface original + jogo local presentes.")
