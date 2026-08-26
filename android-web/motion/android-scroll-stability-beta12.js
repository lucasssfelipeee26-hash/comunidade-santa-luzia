"use strict";

(() => {
  const VERSION = "2.0.0-beta.14";
  const FLAG = "scrollStabilityBeta14";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let routeKey = `${location.pathname}${location.search}${location.hash}`;
  let routeChangedAt = performance.now();
  let touching = false;
  let lastTouchY = 0;
  let direction = 0;
  let lastInputAt = 0;
  let lastScrollY = Math.max(0, window.scrollY || document.scrollingElement?.scrollTop || 0);
  let mutationAt = 0;

  function now() { return performance.now(); }
  function currentY() { return Math.max(0, window.scrollY || document.scrollingElement?.scrollTop || 0); }
  function audit(type, level, detail) { try { window.SantaLuziaAuditor?.add?.(type, level, detail); } catch {} }

  function markRoute() {
    routeKey = `${location.pathname}${location.search}${location.hash}`;
    routeChangedAt = now();
    touching = false;
    direction = 0;
    lastScrollY = currentY();
  }

  document.addEventListener("touchstart", (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touching = true;
    lastTouchY = touch.clientY;
    direction = 0;
    lastInputAt = now();
  }, { passive: true, capture: true });

  document.addEventListener("touchmove", (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const deltaFinger = touch.clientY - lastTouchY;
    if (Math.abs(deltaFinger) >= 1.5) direction = deltaFinger < 0 ? 1 : -1;
    lastTouchY = touch.clientY;
    lastInputAt = now();
  }, { passive: true, capture: true });

  document.addEventListener("touchend", () => {
    touching = false;
    lastInputAt = now();
    setTimeout(() => { if (!touching && now() - lastInputAt >= 650) direction = 0; }, 700);
  }, { passive: true, capture: true });

  document.addEventListener("wheel", (event) => {
    direction = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0;
    lastInputAt = now();
  }, { passive: true, capture: true });

  new MutationObserver(() => { mutationAt = now(); }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("scroll", () => {
    const y = currentY();
    const t = now();
    const sameRoute = routeKey === `${location.pathname}${location.search}${location.hash}`;
    const nearRouteChange = t - routeChangedAt < 900;
    const activeDownIntent = direction === 1 && t - lastInputAt < 950;
    const abruptUpwardJump = lastScrollY - y > Math.max(90, window.innerHeight * 0.16);
    const layoutWasChanging = t - mutationAt < 320;

    if (sameRoute && !nearRouteChange && activeDownIntent && abruptUpwardJump && layoutWasChanging) {
      audit("scroll-jump", "warning", {
        from: Math.round(lastScrollY),
        to: Math.round(y),
        delta: Math.round(y - lastScrollY),
        touching,
        correction: "none-beta14-native-scroll",
      });
    }
    lastScrollY = y;
  }, { passive: true });

  window.addEventListener("santa-luzia:local-route", markRoute);
  window.addEventListener("popstate", markRoute);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  document.documentElement.style.scrollBehavior = "auto";

  const style = document.createElement("style");
  style.id = "sl-scroll-native-beta14";
  style.textContent = `
    html,body,#root{height:auto!important;min-height:100%!important;}
    html{overflow-y:auto!important;overscroll-behavior-y:auto!important;}
    body.app-mobile-shell{overflow-y:visible!important;touch-action:pan-y pinch-zoom!important;overscroll-behavior-y:auto!important;}
    body.app-mobile-shell #root{overflow:visible!important;min-height:100dvh!important;}
    body.app-mobile-shell main{overflow-y:visible!important;max-height:none!important;}
    body.app-mobile-shell footer{position:relative;z-index:1;}
  `;
  document.head.appendChild(style);
  audit("scroll-stability", "info", { version: VERSION, mode: "native-free-scroll" });
})();
