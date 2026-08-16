const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const raiz = path.resolve(__dirname, "..")
const temporario = path.join(raiz, ".tmp", "whatajong-upstream")
const destinoWeb = path.join(raiz, "android-web", "whatajong")
const destinoAndroid = path.join(raiz, "android", "app", "src", "main", "assets", "public", "whatajong")
const traducaoPt = path.join(raiz, "native-assets", "whatajong", "pt.ts")

const REPOSITORIO = "https://github.com/masylum/whatajong.git"
const COMMIT = "45fe3da7a7d1e87a66ae41b72ee74cc4e0a920d5"
const PNPM = "10.8.0"

function comando(cmd, args, cwd = raiz, env = {}) {
  const executavel = process.platform === "win32" && ["npx", "corepack", "pnpm"].includes(cmd) ? `${cmd}.cmd` : cmd
  const resultado = spawnSync(executavel, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: false,
  })
  if (resultado.status !== 0) throw new Error(`Falha ao executar: ${cmd} ${args.join(" ")}`)
}

function substituir(arquivo, trecho, novoTrecho, descricao) {
  const atual = fs.readFileSync(arquivo, "utf8")
  if (!atual.includes(trecho)) throw new Error(`Não foi possível aplicar a adaptação: ${descricao}`)
  fs.writeFileSync(arquivo, atual.replace(trecho, novoTrecho))
}

function substituirTodas(arquivo, trocas) {
  let atual = fs.readFileSync(arquivo, "utf8")
  for (const [de, para, descricao] of trocas) {
    if (!atual.includes(de)) throw new Error(`Não foi possível aplicar a adaptação: ${descricao}`)
    atual = atual.replace(de, para)
  }
  fs.writeFileSync(arquivo, atual)
}

if (!fs.existsSync(traducaoPt)) throw new Error("Tradução pt-BR do Whatajong não encontrada.")

fs.rmSync(temporario, { recursive: true, force: true })
fs.mkdirSync(temporario, { recursive: true })

console.log(`Preparando Whatajong original no commit ${COMMIT}...`)
comando("git", ["init"], temporario)
comando("git", ["remote", "add", "origin", REPOSITORIO], temporario)
comando("git", ["fetch", "--depth", "1", "origin", COMMIT], temporario)
comando("git", ["checkout", "--detach", "FETCH_HEAD"], temporario)

// O upstream usa pnpm. Fixamos a versão no checkout temporário para o Corepack
// não passar pelo npm/npx, que rejeita o override de Vite existente no projeto.
const pacoteUpstreamPath = path.join(temporario, "package.json")
const pacoteUpstream = JSON.parse(fs.readFileSync(pacoteUpstreamPath, "utf8"))
pacoteUpstream.packageManager = `pnpm@${PNPM}`
fs.writeFileSync(pacoteUpstreamPath, `${JSON.stringify(pacoteUpstream, null, 2)}\n`)

const renderer = path.join(temporario, "src", "renderer")
const i18n = path.join(renderer, "i18n")
fs.copyFileSync(traducaoPt, path.join(i18n, "pt.ts"))

substituirTodas(path.join(i18n, "useTranslation.ts"), [
  [
    'import { es } from "./es"\n\nconst DICTIONARIES = { en, es } as const',
    'import { es } from "./es"\nimport { pt } from "./pt"\n\nconst DICTIONARIES = { pt, en, es } as const',
    "registrar idioma português",
  ],
  [
    '    const locale = global.locale as Locale\n    const dict = DICTIONARIES[locale] ?? DICTIONARIES.en',
    '    const rawLocale = String(global.locale || "pt").toLowerCase()\n    const locale: Locale = rawLocale.startsWith("pt") ? "pt" : rawLocale.startsWith("es") ? "es" : "en"\n    const dict = DICTIONARIES[locale] ?? DICTIONARIES.pt',
    "selecionar pt-BR por padrão",
  ],
])

substituir(
  path.join(renderer, "state", "globalState.tsx"),
  "      locale: navigator.language,",
  '      locale: "pt",',
  "usar português como idioma inicial",
)

fs.writeFileSync(
  path.join(renderer, "lib", "observability.ts"),
  `export function initObservability() {}\n\nexport function captureRun(_runId: string, _type: "solo" | "adventure") {}\n\nexport function captureEvent(_event: string, _properties: Record<string, any>) {}\n`,
)

substituirTodas(path.join(renderer, "styles", "colors.ts"), [
  ['"0": "oklch(99.85% 0.002 85)"', '"0": "#fff8ee"', "marfim Santa Luzia"],
  ['"1000": "oklch(12% 0.003 85)"', '"1000": "#3f171c"', "vinho Santa Luzia"],
  ['90: "#fcf0ee"', '90: "#fff1f2"', "rubi claro"],
  ['80: "#fdddd8"', '80: "#f8d8dc"', "rubi 80"],
  ['70: "#fdc1b9"', '70: "#edaeb7"', "rubi 70"],
  ['60: "#f08d83"', '60: "#d66f7f"', "rubi 60"],
  ['50: "#d94b44"', '50: "#a92a3b"', "rubi 50"],
  ['40: "#84090b"', '40: "#7b1326"', "rubi principal"],
  ['30: "#58110f"', '30: "#5a0b18"', "rubi profundo"],
  ['20: "#3b0306"', '20: "#3b0710"', "vinho profundo"],
  ['10: "#240105"', '10: "#260309"', "vinho escuro"],
  ['90: "#fef1d4"', '90: "#fff8df"', "ouro 90"],
  ['80: "#fee1b7"', '80: "#f8e8ad"', "ouro 80"],
  ['70: "#f8bb73"', '70: "#f0d17c"', "ouro claro"],
  ['60: "#f3a04e"', '60: "#dfbb55"', "ouro 60"],
  ['50: "#e4843f"', '50: "#d4af37"', "ouro principal"],
  ['40: "#b86544"', '40: "#a78328"', "ouro 40"],
  ['30: "#7a3b2e"', '30: "#765b20"', "ouro 30"],
  ['20: "#49211b"', '20: "#4b3510"', "ouro 20"],
  ['10: "#1a0805"', '10: "#2f2208"', "ouro 10"],
  ['90: "#f6f3ec"', '90: "#f7eee2"', "vinho neutro 90"],
  ['80: "#eae7dc"', '80: "#eadbc8"', "vinho neutro 80"],
  ['70: "#d7d3c4"', '70: "#d6bdab"', "vinho neutro 70"],
  ['60: "#b3ad9b"', '60: "#a98283"', "vinho neutro 60"],
  ['50: "#888272"', '50: "#74525a"', "vinho neutro 50"],
  ['40: "#4c4635"', '40: "#5d1020"', "vinho neutro 40"],
  ['30: "#352e1e"', '30: "#490b17"', "vinho neutro 30"],
  ['20: "#221c0b"', '20: "#3b0710"', "vinho neutro 20"],
  ['10: "#120e05"', '10: "#260309"', "vinho neutro 10"],
])

substituirTodas(path.join(renderer, "components", "background.css.ts"), [
  [
    '  overflow: "hidden",\n})',
    '  overflow: "hidden",\n  background: "radial-gradient(circle at 50% 0%, #7b1326 0%, #490b17 46%, #2f060d 100%)",\n})',
    "fundo vinho e rubi",
  ],
  [
    '    mixBlendMode: "overlay",\n    pointerEvents: "none",',
    '    mixBlendMode: "overlay",\n    opacity: 0.32,\n    pointerEvents: "none",',
    "textura suave",
  ],
  [
    '    mixBlendMode: "color-burn",\n    pointerEvents: "none",',
    '    mixBlendMode: "soft-light",\n    opacity: 0.5,\n    filter: "sepia(0.35) saturate(0.85) hue-rotate(315deg)",\n    pointerEvents: "none",',
    "paisagem no tema Santa Luzia",
  ],
])

substituir(
  path.join(renderer, "routes", "run", "runGameOver.tsx"),
  `  function goToNextRound() {\n    batch(() => {\n      run.money += income() + tileCoins() + overAchievementCoins()\n      run.stage = nextRoundStage()\n      run.totalPoints += totalPoints()\n      captureEvent("next_round", { round: round().id, runId: run.runId })\n    })\n  }`,
  `  function goToNextRound() {\n    const completedRound = round().id\n    const accumulatedScore = run.totalPoints + totalPoints()\n    batch(() => {\n      run.money += income() + tileCoins() + overAchievementCoins()\n      run.stage = nextRoundStage()\n      run.totalPoints = accumulatedScore\n      captureEvent("next_round", { round: completedRound, runId: run.runId })\n    })\n\n    try {\n      const bridge = (window as any).SantaLuziaWhatajong\n      const difficulty = run.difficulty === "medium" ? "medio" : run.difficulty === "hard" ? "dificil" : "facil"\n      if (bridge && typeof bridge.checkpoint === "function") {\n        bridge.checkpoint(accumulatedScore, completedRound, difficulty)\n      }\n    } catch {}\n  }`,
  "sincronizar progresso com o ranking Santa Luzia",
)

console.log(`Instalando dependências do Whatajong original com pnpm ${PNPM} via Corepack...`)
comando("corepack", ["pnpm", "install", "--frozen-lockfile"], temporario)
console.log("Compilando Whatajong para execução local no APK...")
comando("corepack", ["pnpm", "run", "build:itch"], temporario, { VITE_ITCH_IO: "true" })

const dist = path.join(temporario, "dist")
if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("A compilação do Whatajong não gerou index.html.")

fs.copyFileSync(path.join(temporario, "LICENSE"), path.join(dist, "WHATAJONG-LICENSE.txt"))
fs.writeFileSync(
  path.join(dist, "SANTA-LUZIA-ADAPTATION.txt"),
  [
    "Whatajong adaptado para o aplicativo Comunidade Santa Luzia.",
    `Código-base: masylum/whatajong @ ${COMMIT}`,
    "Adaptações: português do Brasil, identidade visual rubi/vinho/dourado/marfim, telemetria externa removida e ponte local de pontuação para o ranking.",
    "A execução do jogo é local no APK e não depende de internet.",
    "Consulte WHATAJONG-LICENSE.txt para a licença MIT original.",
    "",
  ].join("\n"),
)

const info = {
  upstream: "masylum/whatajong",
  commit: COMMIT,
  license: "MIT",
  locale: "pt-BR",
  theme: "Santa Luzia rubi-ouro",
  runtime: "offline-local-apk",
}
fs.writeFileSync(path.join(dist, "build-info.json"), JSON.stringify(info, null, 2) + "\n")

fs.rmSync(destinoWeb, { recursive: true, force: true })
fs.mkdirSync(path.dirname(destinoWeb), { recursive: true })
fs.cpSync(dist, destinoWeb, { recursive: true, force: true })

if (fs.existsSync(path.dirname(destinoAndroid))) {
  fs.rmSync(destinoAndroid, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(destinoAndroid), { recursive: true })
  fs.cpSync(dist, destinoAndroid, { recursive: true, force: true })
}

fs.rmSync(temporario, { recursive: true, force: true })
console.log("Whatajong original adaptado e empacotado para execução offline no Android.")
