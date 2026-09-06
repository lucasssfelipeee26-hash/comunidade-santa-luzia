"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaScrollWatchdogBeta21";
  const SAMPLE_MS = 350;
  const HUMAN_WINDOW_MS = 1400;
  const QUIET_FLUSH_MS = 2200;
  const MIN_AUTO_SCROLL_PX = 44;
  const MIN_GROWTH_PX = 56;
  const RESIZE_LOOP_THRESHOLD = 18;

  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let lastHumanAt = performance.now();
  let lastSample = null;
  let autoScrollBucket = null;
  let growthBucket = null;
  let resizeBucket = null;
  let autoScrollTimer = 0;
  let growthTimer = 0;
  let resizeTimer = 0;
  let observer = null;
  const observed = new WeakSet();

  function blackBox() {
    return window.SantaLuziaBlackBox || null;
  }

  function record(type, level, detail, message) {
    try {
      const box = blackBox();
      if (box?.record) box.record(type, level, detail, message);
    } catch {}
  }

  function markHumanInput() {
    lastHumanAt = performance.now();
  }

  for (const type of ["touchstart", "touchmove", "pointerdown", "wheel"]) {
    window.addEventListener(type, markHumanInput, { capture: true, passive: true });
  }
  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) markHumanInput();
  }, true);

  function elementMeta(element) {
    if (!(element instanceof Element)) return null;
    return {
      tag: element.tagName.toLowerCase(),
      id: String(element.id || "").slice(0, 100),
      className: String(element.className || "").slice(0, 180),
      role: String(element.getAttribute("role") || "").slice(0, 80),
      dataAction: String(element.getAttribute("data-action") || element.getAttribute("data-sl-nav-motion") || "").slice(0, 100),
    };
  }

  function geometry() {
    const root = document.documentElement;
    const body = document.body;
    return {
      scrollY: Math.round(window.scrollY || root.scrollTop || body?.scrollTop || 0),
      scrollHeight: Math.max(root.scrollHeight || 0, body?.scrollHeight || 0),
      bodyHeight: body ? Math.round(body.getBoundingClientRect().height) : 0,
      rootHeight: Math.round(root.getBoundingClientRect().height),
      viewportHeight: Math.round(window.innerHeight || root.clientHeight || 0),
    };
  }

  function scheduleFlush(kind) {
    const setter = (timer) => window.setTimeout(() => flush(kind), QUIET_FLUSH_MS);
    if (kind === "scroll") {
      if (autoScrollTimer) clearTimeout(autoScrollTimer);
      autoScrollTimer = setter(autoScrollTimer);
    } else if (kind === "growth") {
      if (growthTimer) clearTimeout(growthTimer);
      growthTimer = setter(growthTimer);
    } else {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setter(resizeTimer);
    }
  }

  function flush(kind) {
    if (!kind || kind === "scroll") {
      if (autoScrollBucket) {
        const bucket = autoScrollBucket;
        autoScrollBucket = null;
        autoScrollTimer = 0;
        record("unexpected-scroll-burst", "warning", bucket, `Rolagem sem interação agrupada: ${bucket.count} movimento(s), ${bucket.totalDistancePx}px.`);
      }
    }
    if (!kind || kind === "growth") {
      if (growthBucket) {
        const bucket = growthBucket;
        growthBucket = null;
        growthTimer = 0;
        record("document-growth-burst", "warning", bucket, `Altura da página oscilou ${bucket.count} vez(es), variação acumulada ${bucket.totalDeltaPx}px.`);
      }
    }
    if (!kind || kind === "resize") {
      if (resizeBucket) {
        const bucket = resizeBucket;
        resizeBucket = null;
        resizeTimer = 0;
        record("resize-loop-burst", "warning", bucket, `Redimensionamento repetitivo detectado: ${bucket.count} alteração(ões).`);
      }
    }
  }

  function sample() {
    if (document.visibilityState !== "visible") return;
    const now = performance.now();
    const current = geometry();
    if (!lastSample) {
      lastSample = { ...current, at: now };
      return;
    }

    const humanRecently = now - lastHumanAt <= HUMAN_WINDOW_MS;
    const scrollDelta = current.scrollY - lastSample.scrollY;
    const heightDelta = current.scrollHeight - lastSample.scrollHeight;

    if (!humanRecently && Math.abs(scrollDelta) >= MIN_AUTO_SCROLL_PX) {
      if (!autoScrollBucket) {
        autoScrollBucket = {
          count: 0,
          totalDistancePx: 0,
          maxStepPx: 0,
          directionChanges: 0,
          lastDirection: 0,
          firstAt: Math.round(now),
          lastAt: Math.round(now),
          firstScrollY: lastSample.scrollY,
          lastScrollY: current.scrollY,
          viewportHeight: current.viewportHeight,
          scrollHeight: current.scrollHeight,
        };
      }
      const direction = Math.sign(scrollDelta);
      autoScrollBucket.count += 1;
      autoScrollBucket.totalDistancePx += Math.abs(scrollDelta);
      autoScrollBucket.maxStepPx = Math.max(autoScrollBucket.maxStepPx, Math.abs(scrollDelta));
      if (autoScrollBucket.lastDirection && direction !== autoScrollBucket.lastDirection) autoScrollBucket.directionChanges += 1;
      autoScrollBucket.lastDirection = direction;
      autoScrollBucket.lastAt = Math.round(now);
      autoScrollBucket.lastScrollY = current.scrollY;
      autoScrollBucket.scrollHeight = current.scrollHeight;
      scheduleFlush("scroll");
    }

    if (Math.abs(heightDelta) >= MIN_GROWTH_PX) {
      if (!growthBucket) {
        growthBucket = {
          count: 0,
          totalDeltaPx: 0,
          maxStepPx: 0,
          growthSteps: 0,
          shrinkSteps: 0,
          directionChanges: 0,
          lastDirection: 0,
          firstAt: Math.round(now),
          lastAt: Math.round(now),
          firstScrollHeight: lastSample.scrollHeight,
          lastScrollHeight: current.scrollHeight,
          viewportHeight: current.viewportHeight,
        };
      }
      const direction = Math.sign(heightDelta);
      growthBucket.count += 1;
      growthBucket.totalDeltaPx += Math.abs(heightDelta);
      growthBucket.maxStepPx = Math.max(growthBucket.maxStepPx, Math.abs(heightDelta));
      if (direction > 0) growthBucket.growthSteps += 1;
      else growthBucket.shrinkSteps += 1;
      if (growthBucket.lastDirection && direction !== growthBucket.lastDirection) growthBucket.directionChanges += 1;
      growthBucket.lastDirection = direction;
      growthBucket.lastAt = Math.round(now);
      growthBucket.lastScrollHeight = current.scrollHeight;
      scheduleFlush("growth");
    }

    lastSample = { ...current, at: now };
  }

  function observeElement(element) {
    if (!observer || !(element instanceof Element) || observed.has(element)) return;
    observed.add(element);
    observer.observe(element);
  }

  function installResizeObserver() {
    if (typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver((entries) => {
      const now = performance.now();
      for (const entry of entries) {
        const element = entry.target;
        const rect = entry.contentRect;
        const key = `${element.tagName}:${element.id || ""}:${String(element.className || "").slice(0, 80)}`;
        if (!resizeBucket) {
          resizeBucket = {
            count: 0,
            distinctElements: [],
            maxWidth: 0,
            maxHeight: 0,
            firstAt: Math.round(now),
            lastAt: Math.round(now),
            lastElement: null,
          };
        }
        resizeBucket.count += 1;
        resizeBucket.lastAt = Math.round(now);
        resizeBucket.maxWidth = Math.max(resizeBucket.maxWidth, Math.round(rect.width));
        resizeBucket.maxHeight = Math.max(resizeBucket.maxHeight, Math.round(rect.height));
        resizeBucket.lastElement = elementMeta(element);
        if (resizeBucket.distinctElements.length < 8 && !resizeBucket.distinctElements.includes(key)) resizeBucket.distinctElements.push(key);
        if (resizeBucket.count >= RESIZE_LOOP_THRESHOLD) scheduleFlush("resize");
      }
    });

    observeElement(document.documentElement);
    if (document.body) observeElement(document.body);
    const root = document.getElementById("root");
    if (root) observeElement(root);
    const main = document.querySelector("main");
    if (main) observeElement(main);

    const mutationObserver = new MutationObserver(() => {
      const currentMain = document.querySelector("main");
      if (currentMain) observeElement(currentMain);
      const currentRoot = document.getElementById("root");
      if (currentRoot) observeElement(currentRoot);
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const interval = window.setInterval(sample, SAMPLE_MS);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installResizeObserver, { once: true });
  else installResizeObserver();

  window.addEventListener("pagehide", () => {
    flush();
    clearInterval(interval);
    try { observer?.disconnect(); } catch {}
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") flush();
    else lastSample = geometry();
  });

  window.SantaLuziaScrollWatchdog = {
    version: VERSION,
    snapshot() {
      return {
        version: VERSION,
        current: geometry(),
        lastHumanInputAgeMs: Math.round(Math.max(0, performance.now() - lastHumanAt)),
        pending: {
          unexpectedScroll: autoScrollBucket,
          documentGrowth: growthBucket,
          resizeLoop: resizeBucket,
        },
      };
    },
    flush,
  };
})();
