"use strict";

const fs = require("node:fs");
const path = require("node:path");

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") {
  console.log("[beta21-final-stability] fora da Motion Beta; nada a fazer.");
  process.exit(0);
}

const root = process.cwd();
const motionDir = path.join(root, "android-web", "motion");

function load(name) {
  const file = path.join(motionDir, name);
  if (!fs.existsSync(file)) throw new Error(`[beta21-final-stability] arquivo ausente: ${name}`);
  return { file, source: fs.readFileSync(file, "utf8") };
}

function save(file, source) {
  fs.writeFileSync(file, source);
}

function replaceOnce(source, pattern, replacement, label, marker) {
  if (marker && source.includes(marker)) return source;
  pattern.lastIndex = 0;
  if (!pattern.test(source)) throw new Error(`[beta21-final-stability] assinatura não encontrada: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

// behavior-fixes: deixa de observar o DOM inteiro durante a montagem do React.
{
  const { file, source: original } = load("windows-behavior-fixes.js");
  let source = original;
  source = replaceOnce(
    source,
    /  function start\(\) \{[\s\S]*?\n  \}/,
    `  function start() {
    apply();
    observer?.disconnect();
    observer = null;
    window.addEventListener("santa-luzia:route-settled", schedule);
    window.addEventListener("popstate", schedule);
    document.documentElement.dataset.beta21BehaviorEventDriven = "true";
  }`,
    "start/MutationObserver do behavior-fixes",
    "beta21BehaviorEventDriven",
  );
  if (/observer\s*=\s*new MutationObserver\(schedule\)/.test(source)) {
    throw new Error("[beta21-final-stability] behavior-fixes ainda observa o DOM continuamente.");
  }
  save(file, source);
}

// preload Windows: as animações opacity/transform e as varreduras contínuas eram
// aplicadas sobre cards, diálogos, tabs e formação durante a troca de tela.
{
  const { file, source: original } = load("windows-preload-v5.js");
  let source = original;

  source = replaceOnce(
    source,
    /function animar\(el, keyframes, options = \{\}\) \{[\s\S]*?\n\}/,
    `function animar(el, _keyframes, options = {}) {
  if (!(el instanceof Element)) return null;
  try {
    el.getAnimations?.().filter((a) => !options.id || a.id === options.id).forEach((a) => a.cancel());
    if (el instanceof HTMLElement) {
      el.style.removeProperty("opacity");
      el.style.removeProperty("filter");
      el.style.removeProperty("transform");
    }
  } catch {}
  return null;
}`,
    "helper animar do windows-preload-v5",
    "function animar(el, _keyframes, options = {})",
  );

  source = replaceOnce(
    source,
    /function aplicarInteracoes\(\) \{[\s\S]*?\n\}/,
    `function aplicarInteracoes() {
  if (document.documentElement.dataset.slInteractionBound === PATCH_VERSION) return;
  document.documentElement.dataset.slInteractionBound = PATCH_VERSION;
  // Beta 21 Android: interação visual é responsabilidade do React/CSS nativo.
  // Não executar varreduras completas do DOM em pointerdown/up/click.
}`,
    "interações globais do windows-preload-v5",
    "interação visual é responsabilidade do React/CSS nativo",
  );

  source = replaceOnce(
    source,
    /function iniciar\(\) \{[\s\S]*?\n\}/,
    `function iniciar() {
  injetarEstilos();
  aplicarInteracoes();
  const aplicarRotaEstavel = () => {
    logoAnimado = false;
    ultimoTabAtivo = "";
    rankingVisivel = false;
    const executar = () => aplicarTudo(true);
    if (typeof requestIdleCallback === "function") requestIdleCallback(executar, { timeout: 450 });
    else setTimeout(executar, 90);
  };
  aplicarRotaEstavel();
  window.addEventListener("santa-luzia:route-settled", aplicarRotaEstavel);
  window.addEventListener("popstate", aplicarRotaEstavel);
  document.documentElement.dataset.beta21PreloadStaticMotion = "true";
}`,
    "iniciar/MutationObserver/polling do windows-preload-v5",
    "beta21PreloadStaticMotion",
  );

  if (/observer\s*=\s*new MutationObserver\(\(\)=>agendar/.test(source)) {
    throw new Error("[beta21-final-stability] preload ainda observa class/style continuamente.");
  }
  if (source.includes('setInterval(()=>{ const route = `${location.pathname}${location.search}${location.hash}`')) {
    throw new Error("[beta21-final-stability] polling de 300ms do preload ainda está ativo.");
  }
  save(file, source);
}

// beta7-polish: troca observer/polling por eventos explícitos de rota.
{
  const { file, source: original } = load("windows-beta7-polish.js");
  let source = original;
  source = replaceOnce(
    source,
    /  function start\(\) \{[\s\S]*?\n  \}/,
    `  function start() {
    ensureStyles();
    bindSmoothNavigation();
    applyAll(true);
    observer?.disconnect();
    observer = null;
    const routeReady = () => {
      currentUserPromise = null;
      document.querySelectorAll(".sl-b7-presence-banner,.sl-b9-private-presence").forEach((el) => el.remove());
      schedule(true);
    };
    window.addEventListener("santa-luzia:route-settled", routeReady);
    window.addEventListener("popstate", routeReady);
    window.addEventListener("resize", () => restoreAndroidBottomNav());
    document.documentElement.dataset.beta21PolishEventDriven = "true";
  }`,
    "start/observer/polling do beta7-polish",
    "beta21PolishEventDriven",
  );
  if (/observer\s*=\s*new MutationObserver\(\(\) => schedule\(false\)\)/.test(source)) {
    throw new Error("[beta21-final-stability] beta7-polish ainda observa DOM continuamente.");
  }
  save(file, source);
}

// runtime Windows: mantém as melhorias estáticas, mas retira observer global,
// polling de quiz a cada 500ms e loops decorativos que competiam com o WebView.
{
  const { file, source: original } = load("windows-beta-runtime.js");
  let source = original;

  const coverCss = '.sl-runtime-route-cover { display:none !important; pointer-events:none !important; opacity:0 !important; backdrop-filter:none !important; }';
  const staticCss = `${coverCss}\n    /* beta21-runtime-static-motion */\n    .app-mobile-shell .sl-r7-animated-nav-source,\n    .app-mobile-shell [data-sl-nav-motion] svg,\n    .app-mobile-shell .sl-r7-books-icon i,\n    .app-mobile-shell .sl-r7-liturgy-icon::after,\n    .app-mobile-shell .sl-r7-panel-icon i,\n    .app-mobile-shell .sl-r10-profile-icon,\n    .app-mobile-shell .sl-r5-card-trophy,\n    .app-mobile-shell .sl-b9-private-presence,\n    .app-mobile-shell .sl-top-avatar::before,\n    .app-mobile-shell .sl-formation-highlight::after { animation:none !important; will-change:auto !important; }`;
  if (!source.includes("beta21-runtime-static-motion")) {
    if (!source.includes(coverCss)) throw new Error("[beta21-final-stability] âncora CSS do runtime Windows mudou.");
    source = source.replace(coverCss, staticCss);
  }

  source = replaceOnce(
    source,
    /  let scheduled = false;\n  const observer = new MutationObserver\(\(\) => \{[\s\S]*?\n  setInterval\(expireTransientNotifications, 15_000\);/,
    `  let scheduled = false;
  function runEnhancements() {
    removeLateArrivalBanner();
    ensureQuizVisible();
    fixPodiumTrophies();
    applyFormationPresenceLock();
    enhancePresenceCenter();
    organizePublishedScale();
    renderMyAdministrativeRecords();
    organizeFormationManagement();
    enhanceDelayClocks();
    enhanceProfileAndSoundControls();
    enhanceAnimatedNavigationIcons();
    enhanceProfileIconAndInstalledState();
    removeRedundantCopy();
    enhancePersonalThemePicker();
    expireTransientNotifications();
  }
  function scheduleEnhancements() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; runEnhancements(); });
  }
  runEnhancements();
  window.addEventListener("santa-luzia:route-settled", scheduleEnhancements);
  window.addEventListener("popstate", scheduleEnhancements);
  window.addEventListener("santa-luzia:server-sync", scheduleEnhancements);
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (location.pathname.includes("/formacao") || location.pathname.includes("/ranking")) updatePresenceClock();
  }, 1_000);
  setInterval(expireTransientNotifications, 60_000);
  document.documentElement.dataset.beta21RuntimeEventDriven = "true";`,
    "observer/intervalos do windows-beta-runtime",
    "beta21RuntimeEventDriven",
  );

  if (/const observer = new MutationObserver\(\(\) => \{/.test(source)) {
    throw new Error("[beta21-final-stability] runtime Windows ainda contém observer global de UI.");
  }
  if (source.includes("setInterval(ensureQuizVisible, 500)")) {
    throw new Error("[beta21-final-stability] polling de quiz a 500ms ainda está ativo.");
  }
  save(file, source);
}

for (const [name, marker] of [
  ["windows-behavior-fixes.js", "beta21BehaviorEventDriven"],
  ["windows-preload-v5.js", "beta21PreloadStaticMotion"],
  ["windows-beta7-polish.js", "beta21PolishEventDriven"],
  ["windows-beta-runtime.js", "beta21RuntimeEventDriven"],
]) {
  const source = load(name).source;
  if (!source.includes(marker)) throw new Error(`[beta21-final-stability] marcador final ausente em ${name}: ${marker}`);
}

console.log("[beta21-final-stability] loops visuais/observers herdados removidos; runtime Android agora é orientado a eventos de rota.");
