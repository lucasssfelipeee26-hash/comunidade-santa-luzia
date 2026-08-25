"use strict";

(() => {
  const VERSION = "2.0.0-beta.12";
  const FLAG = "scrollStabilityBeta12";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let routeKey = `${location.pathname}${location.search}${location.hash}`;
  let routeChangedAt = performance.now();
  let touching = false;
  let lastTouchY = 0;
  let direction = 0; // 1 = usuário está descendo a página; -1 = subindo
  let lastInputAt = 0;
  let maxYDuringDownGesture = window.scrollY;
  let lastScrollY = window.scrollY;
  let correcting = false;
  let mutationAt = 0;
  let correctionCount = 0;

  function audit(level, detail) {
    try { window.SantaLuziaAuditor?.add?.("scroll-stability", level, detail); } catch {}
  }

  function now() { return performance.now(); }
  function currentY() { return Math.max(0, window.scrollY || document.scrollingElement?.scrollTop || 0); }

  function markRoute() {
    routeKey = `${location.pathname}${location.search}${location.hash}`;
    routeChangedAt = now();
    touching = false;
    direction = 0;
    maxYDuringDownGesture = 0;
    lastScrollY = 0;
  }

  document.addEventListener("touchstart", (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touching = true;
    lastTouchY = touch.clientY;
    direction = 0;
    lastInputAt = now();
    maxYDuringDownGesture = currentY();
  }, { passive: true, capture: true });

  document.addEventListener("touchmove", (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const deltaFinger = touch.clientY - lastTouchY;
    // Dedo sobe => conteúdo/página deve avançar para baixo.
    if (Math.abs(deltaFinger) >= 1.5) direction = deltaFinger < 0 ? 1 : -1;
    lastTouchY = touch.clientY;
    lastInputAt = now();
    if (direction === 1) maxYDuringDownGesture = Math.max(maxYDuringDownGesture, currentY());
  }, { passive: true, capture: true });

  document.addEventListener("touchend", () => {
    touching = false;
    lastInputAt = now();
    // Mantém a direção por um curto período para cobrir a inércia do Android.
    setTimeout(() => {
      if (!touching && now() - lastInputAt >= 680) direction = 0;
    }, 700);
  }, { passive: true, capture: true });

  document.addEventListener("wheel", (event) => {
    direction = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0;
    lastInputAt = now();
    if (direction === 1) maxYDuringDownGesture = Math.max(maxYDuringDownGesture, currentY());
  }, { passive: true, capture: true });

  new MutationObserver(() => { mutationAt = now(); }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("scroll", () => {
    if (correcting) return;
    const y = currentY();
    const t = now();
    const sameRoute = routeKey === `${location.pathname}${location.search}${location.hash}`;
    const nearRouteChange = t - routeChangedAt < 900;
    const activeDownIntent = direction === 1 && t - lastInputAt < 950;
    const abruptUpwardJump = lastScrollY - y > 72;
    const layoutWasChanging = t - mutationAt < 280;

    if (activeDownIntent) maxYDuringDownGesture = Math.max(maxYDuringDownGesture, lastScrollY, y);

    // O bug observado no vídeo é uma queda brusca de scroll enquanto o usuário
    // continua tentando descer. Só corrigimos quando há intenção explícita de
    // descer + mutação/layout recente, e nunca durante navegação de rota.
    if (sameRoute && !nearRouteChange && activeDownIntent && abruptUpwardJump && layoutWasChanging && maxYDuringDownGesture > y + 60) {
      const target = maxYDuringDownGesture;
      correcting = true;
      requestAnimationFrame(() => {
        window.scrollTo({ top: target, behavior: "instant" });
        lastScrollY = target;
        correcting = false;
      });
      correctionCount += 1;
      audit("warning", { from: Math.round(lastScrollY), to: Math.round(y), restored: Math.round(target), corrections: correctionCount });
      return;
    }

    lastScrollY = y;
  }, { passive: true });

  window.addEventListener("santa-luzia:local-route", markRoute);
  window.addEventListener("popstate", markRoute);

  // Evita âncoras automáticas do navegador em listas que mudam de tamanho.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  document.documentElement.style.scrollBehavior = "auto";
  audit("info", { version: VERSION, status: "armed" });
})();
