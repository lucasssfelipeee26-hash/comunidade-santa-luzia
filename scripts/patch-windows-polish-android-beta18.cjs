const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const file = path.join(root, "android-web", "motion", "windows-beta7-polish.js")
if (!fs.existsSync(file)) throw new Error("windows-beta7-polish.js ausente; execute fetch-windows-beta-stack antes.")

let source = fs.readFileSync(file, "utf8")

// A camada herdada da Windows Beta foi criada para uma janela desktop. No Android
// ela estava escurecendo a tela inteira em cada clique e iniciando a nova rota com
// opacity 0.32. Em WebView isso se manifesta como a piscada registrada pela auditoria.
const brokenResize = 'window.addEventListener("resize", () => updateBottomNav());'
const fixedResize = 'window.addEventListener("resize", () => restoreAndroidBottomNav());'
if (source.includes(brokenResize)) source = source.replace(brokenResize, fixedResize)
else if (!source.includes(fixedResize)) throw new Error("Assinatura esperada do resize não encontrada; não vou alterar a camada visual às cegas.")

const oldShieldCss = '.sl-b7-route-shield { position:fixed; inset:0; z-index:165; pointer-events:none; opacity:0; background:rgba(255,250,240,.68); backdrop-filter:blur(1.5px) saturate(.98); }'
const newShieldCss = '.sl-b7-route-shield { display:none !important; pointer-events:none !important; opacity:0 !important; backdrop-filter:none !important; }'
if (source.includes(oldShieldCss)) source = source.replace(oldShieldCss, newShieldCss)
else if (!source.includes(newShieldCss)) throw new Error("CSS do route shield mudou; correção Android não aplicada.")

const oldRouteFunctions = `  function showShield() {
    const shield = ensureShield();
    if (shieldTimer) clearTimeout(shieldTimer);
    shield.getAnimations?.().forEach((a) => a.cancel());
    animate(shield, [{opacity:0},{opacity:.72}], { duration:150, id:"sl-b7-shield-in" });
    shieldTimer = setTimeout(() => hideShield(), 900);
  }

  function hideShield() {
    const shield = document.querySelector(".sl-b7-route-shield");
    if (!shield) return;
    if (shieldTimer) clearTimeout(shieldTimer);
    shield.getAnimations?.().forEach((a) => a.cancel());
    const a = animate(shield, [{opacity:.72},{opacity:0}], { duration:300, id:"sl-b7-shield-out" });
    if (a) a.finished.finally(() => { if (shield.isConnected) shield.style.opacity = "0"; });
  }

  function animateRoute(force = false) {
    const route = \`${'${location.pathname}${location.search}${location.hash}'}\`;
    if (!force && route === lastRoute) return;
    lastRoute = route;
    const main = document.querySelector("main");
    if (main) {
      main.getAnimations?.().filter((a) => a.id === "sl-page-enter" || a.id === "sl-b7-route-enter").forEach((a) => a.cancel());
      animate(main, [
        { opacity:.32, transform:"translate3d(0,6px,0) scale(.998)", filter:"brightness(.985)" },
        { opacity:1, transform:"translate3d(0,0,0) scale(1)", filter:"brightness(1)" }
      ], { duration:430, easing:"cubic-bezier(.16,.84,.24,1)", id:"sl-b7-route-enter" });
    }
    setTimeout(hideShield, 45);
  }
`

const newRouteFunctions = `  function showShield() {
    // Android: a página atual permanece visível até a próxima rota estar pronta.
  }

  function hideShield() {
    const shield = document.querySelector(".sl-b7-route-shield");
    if (shieldTimer) clearTimeout(shieldTimer);
    shieldTimer = null;
    if (shield) {
      shield.getAnimations?.().forEach((a) => a.cancel());
      shield.remove();
    }
  }

  function animateRoute(force = false) {
    const route = \`${'${location.pathname}${location.search}${location.hash}'}\`;
    if (!force && route === lastRoute) return;
    lastRoute = route;
    const main = document.querySelector("main");
    if (main) {
      main.getAnimations?.().filter((a) => a.id === "sl-page-enter" || a.id === "sl-b7-route-enter").forEach((a) => a.cancel());
      main.style.removeProperty("opacity");
      main.style.removeProperty("filter");
      main.style.removeProperty("transform");
    }
    hideShield();
  }
`

if (source.includes(oldRouteFunctions)) source = source.replace(oldRouteFunctions, newRouteFunctions)
else if (!source.includes("Android: a página atual permanece visível")) throw new Error("Bloco de transição herdada mudou; correção anti-flicker não aplicada.")

// O polling de 300 ms fazia varreduras de DOM mesmo sem mudança de rota. O observer
// continua detectando mudanças imediatamente; este timer passa a ser apenas fallback.
source = source.replace("    }, 300);", "    }, 1200);")

if (/\bupdateBottomNav\s*\(/.test(source)) throw new Error("Referência updateBottomNav ainda executável após correção.")
if (!source.includes("restoreAndroidBottomNav()")) throw new Error("restoreAndroidBottomNav ausente após correção.")
if (source.includes('{ opacity:.32, transform:"translate3d(0,6px,0) scale(.998)"')) throw new Error("Fade de rota ainda presente no runtime Android.")
if (source.includes('animate(shield, [{opacity:0},{opacity:.72}]')) throw new Error("Route shield ainda anima no runtime Android.")

fs.writeFileSync(file, source)
console.log("[beta21] Transições Android estabilizadas: sem route shield, sem fade do main e polling reduzido.")
