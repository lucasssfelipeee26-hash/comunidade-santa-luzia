"use strict";

const fs = require("node:fs");
const path = require("node:path");

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") {
  console.log("[beta21-navigation-runtime] fora do canal Motion Beta; nada a fazer.");
  process.exit(0);
}

const root = process.cwd();
const motionDir = path.join(root, "android-web", "motion");

function read(name) {
  const file = path.join(motionDir, name);
  if (!fs.existsSync(file)) throw new Error(`Runtime obrigatório ausente: ${name}`);
  return { file, source: fs.readFileSync(file, "utf8") };
}

function write(file, source) {
  fs.writeFileSync(file, source);
}

function replaceOrFail(source, pattern, replacement, label, alreadyMarker) {
  if (alreadyMarker && source.includes(alreadyMarker)) return source;
  if (!pattern.test(source)) throw new Error(`Assinatura esperada não encontrada: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

// 1) O runtime herdado da interface Windows ainda reproduzia uma segunda animação
// de página inteira (opacity .25 -> 1) em TODA mudança de rota. Essa animação não
// era a mesma route-shield já removida e corresponde ao branco/piscar visto no vídeo.
{
  const { file, source: original } = read("windows-behavior-fixes.js");
  let source = original.replace(
    ".sl-b4-nav-pending { pointer-events:none; opacity:.78; }",
    ".sl-b4-nav-pending { pointer-events:none; opacity:1; }",
  );
  source = replaceOrFail(
    source,
    /  function replayOnRouteChange\(\) \{[\s\S]*?\n  \}\n\n  function apply\(\) \{/,
    `  function replayOnRouteChange() {
    const route = \`${"${location.pathname}${location.search}${location.hash}"}\`;
    if (route === lastRoute) return;
    lastRoute = route;
    const main = document.querySelector("main");
    if (!main) return;
    main.getAnimations?.().forEach((animation) => {
      try {
        const effectTarget = animation.effect?.target;
        if (effectTarget === main) animation.cancel();
      } catch {}
    });
    main.style.removeProperty("opacity");
    main.style.removeProperty("transform");
    main.style.removeProperty("filter");
    main.dataset.beta21NavigationRuntimeStable = "true";
  }

  function apply() {`,
    "fade de rota em windows-behavior-fixes.js",
    'main.dataset.beta21NavigationRuntimeStable = "true"',
  );
  if (source.includes("{ opacity: .25, transform: \"translateY(6px) scale(.998)\" }")) {
    throw new Error("Fade de página do windows-behavior-fixes ainda está ativo.");
  }
  write(file, source);
}

// 2) O preload Windows executava OUTRO fade de página completa, desta vez começando
// em opacity 0. No WebView isso cria literalmente o quadro branco gravado no vídeo.
// Só a animação de entrada da PÁGINA é removida; animações internas continuam intactas.
{
  const { file, source: original } = read("windows-preload-v5.js");
  const source = replaceOrFail(
    original,
    /function animarEntradaPagina\(force = false\) \{[\s\S]*?\n\}\n\nfunction animarLogo\(force = false\) \{/,
    `function animarEntradaPagina(force = false) {
  const rota = \`${"${location.pathname}${location.search}${location.hash}"}\`;
  if (!force && rota === rotaAtual) return;
  rotaAtual = rota;
  const main = document.querySelector("main");
  if (!main) return;
  main.getAnimations?.().filter((animation) => animation.id === "sl-page-enter").forEach((animation) => animation.cancel());
  main.style.removeProperty("opacity");
  main.style.removeProperty("transform");
  main.style.removeProperty("filter");
  main.dataset.beta21PageEntryStatic = "true";
}

function animarLogo(force = false) {`,
    "animarEntradaPagina do windows-preload-v5.js",
    'main.dataset.beta21PageEntryStatic = "true"',
  );
  if (source.includes('animar(main, [{ opacity:0, transform:"translate3d(0,10px,0) scale(.996)" }')) {
    throw new Error("Fade de entrada do windows-preload-v5 ainda está ativo.");
  }
  write(file, source);
}

// 3) A camada Motion histórica fazia fetch de ranking antes da autenticação, aquecia
// o Service Worker e revarria o DOM em cada mutação. Isso explica os 401 no LOGIN e
// parte das long-tasks durante troca rápida de abas. A UI React atual já possui banner,
// sessão central, ServerSync e snapshot offline; portanto o aquecimento legado é redundante.
{
  const { file, source: original } = read("android-motion-beta.js");
  let source = replaceOrFail(
    original,
    /  async function refreshDelayBanner\(force = false\) \{[\s\S]*?\n  \}\n\n  function warmOriginalInterface\(\) \{/,
    `  async function refreshDelayBanner(_force = false) {
    // Beta 21: o LateArrivalBanner React é a única fonte do ranking em tela.
    // Não consultar endpoint protegido a partir do runtime global antes da sessão.
    return;
  }

  function warmOriginalInterface() {`,
    "refreshDelayBanner legado",
    "LateArrivalBanner React é a única fonte",
  );
  source = replaceOrFail(
    source,
    /  function warmOriginalInterface\(\) \{[\s\S]*?\n  \}\n\n  function apply\(\) \{/,
    `  function warmOriginalInterface() {
    // O snapshot/server-sync moderno já faz o aquecimento coordenado depois da auth.
    // Não disparar AQUECER_CACHE_PRIVADO durante navegação normal.
  }

  function apply() {`,
    "aquecimento legado do Service Worker",
    "snapshot/server-sync moderno",
  );
  source = replaceOrFail(
    source,
    /  addStyles\(\);\n  apply\(\);\n  warmOriginalInterface\(\);[\s\S]*?\n  setInterval\(\(\) => \{ schedule\(\); if \(navigator\.onLine\) void refreshDelayBanner\(false\); \}, DELAY_REFRESH_MS\);/,
    `  addStyles();
  apply();
  // Nada de MutationObserver global nem polling permanente. O patch visual legado
  // é reaplicado apenas depois que uma navegação REAL terminou.
  window.addEventListener("santa-luzia:route-settled", () => window.setTimeout(schedule, 80));
  window.addEventListener("popstate", schedule);`,
    "observação/polling global do android-motion-beta",
    "Nada de MutationObserver global nem polling permanente",
  );
  if (/new MutationObserver\(schedule\)/.test(source) || source.includes("void refreshDelayBanner(true)")) {
    throw new Error("Runtime Motion histórico ainda dispara trabalho global durante navegação.");
  }
  write(file, source);
}

// 4) O prewarm Beta 10 baixava uma lista grande de APIs, até 160 perfis e arquivos
// de formação em eventos online/focus/sync. Isso concorria com a rota recém-aberta.
{
  const { file, source: original } = read("android-original-ui-beta10.js");
  const source = replaceOrFail(
    original,
    /  window\.addEventListener\("online", \(\) => void warm\(true\)\);[\s\S]*?\n  setTimeout\(\(\) => void warm\(false\), 3500\);/,
    `  // Beta 21: prewarm massivo desligado do caminho normal. ServerSync e o
  // AndroidOfflineSnapshotRuntime fazem sincronização coordenada após autenticação.
  window.addEventListener("santa-luzia:explicit-cache-warm", () => void warm(false));`,
    "gatilhos automáticos de prewarm",
    "prewarm massivo desligado",
  );
  if (source.includes('window.addEventListener("santa-luzia:server-sync", () => void warm(true))') || source.includes("setTimeout(() => void warm(false), 800)")) {
    throw new Error("Prewarm massivo ainda está ligado a eventos automáticos.");
  }
  write(file, source);
}

// 5) O Deep Auditor consultava /api/configuracao/diagnostico imediatamente no boot,
// inclusive na tela de login, gerando o 403 registrado. A configuração passa a ser
// resolvida somente quando o usuário executar a auditoria profunda.
{
  const { file, source: original } = read("android-deep-auditor-beta16.js");
  let source = original;
  if (!source.includes("Beta 21: DSN lazy")) {
    if (!source.includes("  void resolveDsn();")) throw new Error("Inicialização eager do DSN não encontrada.");
    source = source.replace("  void resolveDsn();", "  // Beta 21: DSN lazy — resolveDsn() é chamado somente dentro de run().");
  }
  write(file, source);
}

function wrapDeepVisual(name, apiName, flagName, stubSource) {
  const { file, source } = read(name);
  if (source.includes("beta21-deep-visual-opt-in")) return;
  const wrapped = `;(() => {
  const beta21DeepVisualEnabled = (() => {
    try { return localStorage.getItem("santa-luzia:deep-visual-diagnostics") === "1"; }
    catch { return false; }
  })();
  if (!beta21DeepVisualEnabled) {
    document.documentElement.dataset["${flagName}"] = "beta21-deep-visual-opt-in";
    ${stubSource}
    return;
  }
${source}
})();\n`;
  write(file, wrapped);
}

// 6) O vídeo + diagnóstico mostram long-tasks justamente quando o vigia dispara
// precision-burst/72 frames. Mantemos a instrumentação disponível por opt-in, mas
// ela não pode competir com o React em cada clique da barra de navegação.
wrapDeepVisual(
  "android-visual-forensics-beta21.js",
  "SantaLuziaVisualForensics",
  "santaLuziaVisualForensicsBeta21",
  `window.SantaLuziaVisualForensics = {
      version: "2.0.0-beta.21",
      engine: "always-on-visual-sentinel-v2-paused",
      snapshot: () => ({
        version: "2.0.0-beta.21",
        engine: "always-on-visual-sentinel-v2-paused",
        mode: "privacy-preserving-visual-timeline-paused",
        watch: { alwaysOnWhileAppRunning: false, samplingMs: 0, reason: "navigation-stability" },
        continuousTimeline: [], currentRunIncidents: [], activeIncidents: [],
      }),
      clear: () => {}, startIncident: () => null, captureNow: () => null,
    };`,
);

wrapDeepVisual(
  "android-visual-burst-beta21.js",
  "SantaLuziaVisualBurst",
  "santaLuziaVisualBurstBeta21",
  `window.SantaLuziaVisualBurst = {
      version: "2.0.0-beta.21",
      startBurst: () => {},
      status: () => ({ active: false, reason: "precision-burst disabled", transitionEvent: "transition-run", targetFps: 0 }),
    };`,
);

const validationFiles = [
  "windows-behavior-fixes.js",
  "windows-preload-v5.js",
  "android-motion-beta.js",
  "android-original-ui-beta10.js",
  "android-deep-auditor-beta16.js",
  "android-visual-forensics-beta21.js",
  "android-visual-burst-beta21.js",
];
for (const name of validationFiles) {
  const source = read(name).source;
  if (!source.trim()) throw new Error(`Runtime ficou vazio após patch: ${name}`);
}

console.log("[beta21-navigation-runtime] rota sem fade global; prewarm/observers legados removidos do caminho crítico; diagnóstico visual profundo em opt-in.");
