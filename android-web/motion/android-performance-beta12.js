"use strict";

(() => {
  const VERSION = "2.0.0-beta.12";
  const FLAG = "performanceBeta12";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const style = document.createElement("style");
  style.id = "sl-android-performance-beta12";
  style.textContent = `
    html.app-mobile-shell, html:has(body.app-mobile-shell), body.app-mobile-shell {
      scroll-behavior:auto !important;
      overscroll-behavior-y:none !important;
    }
    body.app-mobile-shell {
      overflow-x:hidden !important;
      overflow-y:auto;
      -webkit-overflow-scrolling:touch;
      touch-action:pan-y pinch-zoom;
    }
    body.app-mobile-shell main {
      overflow-anchor:none;
      backface-visibility:hidden;
      transform:translateZ(0);
      will-change:auto;
    }
    body.app-mobile-shell .sl-b7-route-shield,
    body.app-mobile-shell .sl-runtime-route-cover {
      display:none !important;
      backdrop-filter:none !important;
      -webkit-backdrop-filter:none !important;
    }
    body.app-mobile-shell .app-nav-panel,
    body.app-mobile-shell [role="dialog"][aria-modal="true"] {
      contain:layout paint;
    }
    body.app-mobile-shell img {
      content-visibility:auto;
    }
    body.app-mobile-shell [data-escala-historico="true"],
    body.app-mobile-shell article {
      contain-intrinsic-size:auto 180px;
    }
    html[data-sl-motion-performance="economy"] .sl-b11-card-trophy,
    html[data-sl-motion-performance="economy"] .sl-r5-card-trophy,
    html[data-sl-motion-performance="economy"] [data-sl-nav-motion] svg,
    html[data-sl-motion-performance="economy"] .sl-r10-profile-icon {
      animation-duration:5.5s !important;
    }
    @media (prefers-reduced-motion:reduce) {
      body.app-mobile-shell main { transform:none !important; }
    }
  `;
  document.head.appendChild(style);

  let lastRoute = `${location.pathname}${location.search}${location.hash}`;
  let lastFrameSample = 0;
  let routeLock = false;

  function audit(type, level, detail) {
    try { window.SantaLuziaAuditor?.add?.(type, level, detail); } catch {}
  }

  function unlockBodyIfSafe() {
    const activeModal = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!activeModal && document.body.style.overflow === "hidden") document.body.style.removeProperty("overflow");
  }

  function resetScroll() {
    const scroller = document.scrollingElement || document.documentElement;
    try { scroller.scrollTop = 0; } catch {}
    try { window.scrollTo(0, 0); } catch {}
  }

  function animateMain() {
    const main = document.querySelector("main");
    if (!main || typeof main.animate !== "function") return;
    try {
      main.getAnimations().forEach((animation) => {
        if (/route|page|enter/i.test(animation.id || "")) animation.cancel();
      });
      const animation = main.animate([
        { opacity:.86, transform:"translate3d(0,3px,0)" },
        { opacity:1, transform:"translate3d(0,0,0)" },
      ], { duration:180, easing:"cubic-bezier(.2,.78,.2,1)", fill:"both" });
      animation.id = "sl-b12-route-enter";
      animation.finished.finally(() => {
        if (!main.isConnected) return;
        main.style.removeProperty("opacity");
        main.style.removeProperty("transform");
      });
    } catch {}
  }

  function onRoute() {
    const route = `${location.pathname}${location.search}${location.hash}`;
    if (route === lastRoute && routeLock) return;
    lastRoute = route;
    routeLock = true;
    unlockBodyIfSafe();
    resetScroll();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animateMain();
        routeLock = false;
      });
    });
  }

  async function physicalConnected() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (network?.getStatus) return Boolean((await network.getStatus())?.connected);
    } catch {}
    return navigator.onLine;
  }

  function sampleFps() {
    const now = performance.now();
    if (now - lastFrameSample < 8000) return;
    lastFrameSample = now;
    const start = now;
    let frames = 0;
    function frame(ts) {
      frames += 1;
      if (ts - start < 1500) return requestAnimationFrame(frame);
      const fps = (frames * 1000) / Math.max(1, ts - start);
      const economy = fps < 42;
      document.documentElement.dataset.slMotionPerformance = economy ? "economy" : "full";
      audit("motion-fps-mode", economy ? "warning" : "info", { fps: Math.round(fps), mode: economy ? "economy" : "full" });
    }
    requestAnimationFrame(frame);
  }

  // Evita o navegador manter uma animação de scroll antiga enquanto o React
  // substitui a tela, uma das causas de saltos e sensação de rolagem infinita.
  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.href === location.href) return;
    const scroller = document.scrollingElement || document.documentElement;
    if (typeof scroller.getAnimations === "function") scroller.getAnimations().forEach((animation) => animation.cancel());
  }, true);

  window.addEventListener("santa-luzia:local-route", () => { onRoute(); sampleFps(); });
  window.addEventListener("popstate", () => { onRoute(); sampleFps(); });
  window.addEventListener("focus", () => { unlockBodyIfSafe(); sampleFps(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { unlockBodyIfSafe(); sampleFps(); } });

  // Em rede física offline não fazemos qualquer tentativa adicional de
  // transição remota. A UI local já está carregada e permanece responsiva.
  setTimeout(async () => {
    document.documentElement.dataset.slPhysicalConnected = (await physicalConnected()) ? "true" : "false";
    sampleFps();
  }, 500);
})();
