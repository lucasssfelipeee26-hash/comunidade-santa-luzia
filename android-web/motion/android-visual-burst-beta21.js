"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaVisualBurstBeta21";
  const FRAME_INTERVAL_MS = 32;
  const CLICK_BURST_MS = 1400;
  const ROUTE_BURST_MS = 2200;
  const ANOMALY_BURST_MS = 2400;
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let burstUntil = 0;
  let rafId = 0;
  let lastFrameAt = 0;
  let reason = "idle";

  function clamp(value, max = 120) {
    const text = String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function targetMeta(element) {
    if (!(element instanceof Element)) return null;
    return {
      tag: element.tagName.toLowerCase(),
      id: clamp(element.id, 60),
      className: clamp(typeof element.className === "string" ? element.className : element.getAttribute("class"), 160),
      role: clamp(element.getAttribute("role"), 50),
      dataAction: clamp(element.getAttribute("data-action") || element.getAttribute("data-sl-nav-motion"), 80),
      inHeader: Boolean(element.closest("header")),
      inNavigation: Boolean(element.closest("nav,[role='navigation'],.app-nav-panel,.mobile-app-bottom-nav,.app-mobile-menu-layer")),
      inDialog: Boolean(element.closest("[role='dialog'],[aria-modal='true']")),
    };
  }

  function engine() {
    return window.SantaLuziaVisualForensics || null;
  }

  function tick(now) {
    rafId = 0;
    if (Date.now() >= burstUntil || document.visibilityState !== "visible") return;
    if (now - lastFrameAt >= FRAME_INTERVAL_MS) {
      lastFrameAt = now;
      try { engine()?.captureNow?.(); } catch {}
    }
    rafId = requestAnimationFrame(tick);
  }

  function startBurst(nextReason, durationMs, detail = null) {
    const now = Date.now();
    burstUntil = Math.max(burstUntil, now + durationMs);
    reason = nextReason;
    try {
      engine()?.startIncident?.("precision-burst", {
        reason: nextReason,
        durationMs,
        detail,
        targetFps: Math.round(1000 / FRAME_INTERVAL_MS),
      });
      engine()?.captureNow?.();
    } catch {}
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("button,[role='button'],a[href],input,select,[data-action],[data-sl-nav-motion]")
      : null;
    if (!target) return;
    startBurst("pointerdown", CLICK_BURST_MS, { target: targetMeta(target) });
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("button,[role='button'],a[href],input[type='submit'],input[type='button'],select,[data-action],[data-sl-nav-motion]")
      : null;
    if (!target) return;
    startBurst("click", CLICK_BURST_MS, { target: targetMeta(target) });
  }, true);

  window.addEventListener("santa-luzia:route-start", (event) => {
    startBurst("route-start", ROUTE_BURST_MS, { target: clamp(event?.detail?.target, 180) });
  });

  window.addEventListener("santa-luzia:route-settled", (event) => {
    startBurst("route-settled", ROUTE_BURST_MS, { target: clamp(event?.detail?.target, 180) });
  });

  window.addEventListener("santa-luzia:blackbox-event", (event) => {
    const type = String(event?.detail?.type || "");
    if (["layout-shift-burst", "unexpected-scroll-burst", "document-growth-burst", "resize-loop-burst", "visual-blank-frame", "javascript-error", "unhandled-rejection"].includes(type)) {
      startBurst(type, ANOMALY_BURST_MS, { level: String(event?.detail?.level || "") });
    }
  });

  document.addEventListener("animationstart", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    startBurst("animation-start", CLICK_BURST_MS, {
      animationName: clamp(event.animationName, 100),
      target: targetMeta(target),
    });
  }, true);

  document.addEventListener("transitionrun", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || (!target.closest("header,nav,main,[role='dialog'],.app-nav-panel,.app-mobile-menu-layer") && target !== document.documentElement && target !== document.body)) return;
    startBurst("transition-run", CLICK_BURST_MS, {
      propertyName: clamp(event.propertyName, 100),
      target: targetMeta(target),
    });
  }, true);

  window.addEventListener("pagehide", () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    burstUntil = 0;
  });

  window.SantaLuziaVisualBurst = {
    version: VERSION,
    startBurst,
    status: () => ({ active: Date.now() < burstUntil, burstUntil, reason, targetFps: Math.round(1000 / FRAME_INTERVAL_MS) }),
  };
})();