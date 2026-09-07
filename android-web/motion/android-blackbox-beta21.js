"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaBlackBoxBeta21";
  const EVENTS_KEY = "santa-luzia:blackbox:v1";
  const RUNTIME_KEY = "santa-luzia:blackbox:runtime:v1";
  const LAST_EXIT_KEY = "santa-luzia:blackbox:last-exit:v1";
  const LAST_FATAL_KEY = "santa-luzia:blackbox:last-fatal:v1";
  const MAX_EVENTS = 200;
  const FIVE_MINUTES = 5 * 60 * 1000;
  const SLOW_FETCH_MS = 1200;
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let sequence = 0;
  let events = [];
  const routeTraces = new Map();

  function plugin() { return window.Capacitor?.Plugins?.DeepDiagnostics || null; }

  function clamp(value, max = 700) {
    const text = String(value ?? "")
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redigido]")
      .replace(/([?&](?:token|auth|session|senha|password|code|codigo)=)[^&\s]+/gi, "$1[redigido]")
      .replace(/(?:password|senha|token|authorization|cookie)\s*[:=]\s*[^,;\s}]+/gi, (match) => `${match.split(/[:=]/)[0]}=[redigido]`)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redigido]");
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function safeValue(value, depth = 0) {
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return clamp(value);
    if (depth >= 3) return "[truncado]";
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, depth + 1));
    if (typeof value === "object") {
      const out = {};
      for (const [key, item] of Object.entries(value).slice(0, 30)) {
        if (/password|senha|token|authorization|cookie|body|payload|content/i.test(key)) out[key] = "[redigido]";
        else if (/stack/i.test(key)) out[key] = clamp(item, 3200);
        else out[key] = safeValue(item, depth + 1);
      }
      return out;
    }
    return clamp(value);
  }

  function safePath(input) {
    try {
      const url = new URL(String(input), location.href);
      const query = new URLSearchParams();
      for (const key of ["data", "ano", "escopo", "admin"]) if (url.searchParams.has(key)) query.set(key, clamp(url.searchParams.get(key), 60));
      const suffix = query.toString() ? `?${query}` : "";
      return url.origin === location.origin ? `${url.pathname}${suffix}` : `${url.origin}${url.pathname}${suffix}`;
    } catch { return clamp(input, 220); }
  }

  function readEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(EVENTS_KEY) || "null");
      return Array.isArray(parsed?.events) ? parsed.events.slice(-MAX_EVENTS) : [];
    } catch { return []; }
  }

  let persistScheduled = false;
  function flushPersist() {
    persistScheduled = false;
    try { localStorage.setItem(EVENTS_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), runId, events: events.slice(-MAX_EVENTS) })); } catch {}
  }
  function persist() {
    if (persistScheduled) return;
    persistScheduled = true;
    const run = () => flushPersist();
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 1200 });
    else window.setTimeout(run, 250);
  }

  function writeRuntime(cleanShutdown = false) {
    try {
      localStorage.setItem(RUNTIME_KEY, JSON.stringify({
        version: VERSION,
        runId,
        heartbeatAt: Date.now(),
        cleanShutdown,
        route: `${location.pathname}${location.search}${location.hash}`,
        visibility: document.visibilityState,
      }));
    } catch {}
  }

  async function nativeBreadcrumb(event) {
    const native = plugin();
    if (!native?.recordBreadcrumb) return;
    const important = event.level !== "info" || ["blackbox-start", "route-start", "route-settled", "visibility", "runtime-unclean-restart", "previous-fatal-exception"].includes(event.type);
    if (!important) return;
    try {
      await native.recordBreadcrumb({
        type: event.type,
        level: event.level,
        route: event.route,
        message: clamp(event.message || event.type, 650),
        detailJson: JSON.stringify(safeValue(event.detail || {})),
      });
    } catch {}
  }

  async function nativeNonFatal(event) {
    if (event.level !== "error" && !["visual-blank-frame", "runtime-unclean-restart"].includes(event.type)) return;
    const native = plugin();
    if (!native?.recordNonFatal) return;
    try {
      await native.recordNonFatal({
        type: event.type,
        route: event.route,
        message: clamp(event.message || event.type, 900),
        detailJson: JSON.stringify(safeValue(event.detail || {})),
      });
    } catch {}
  }

  function record(type, level = "info", detail = {}, message = "") {
    const event = {
      id: `${runId}-${++sequence}`,
      at: Date.now(),
      perfAt: Math.round(performance.now()),
      runId,
      type: clamp(type, 90),
      level,
      route: `${location.pathname}${location.search}`,
      visibility: document.visibilityState,
      message: clamp(message || "", 900),
      detail: safeValue(detail),
    };
    events.push(event);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    persist();
    void nativeBreadcrumb(event);
    void nativeNonFatal(event);
    window.dispatchEvent(new CustomEvent("santa-luzia:blackbox-event", { detail: { type: event.type, level: event.level } }));
    return event;
  }

  events = readEvents();

  let previousRuntime = null;
  try { previousRuntime = JSON.parse(localStorage.getItem(RUNTIME_KEY) || "null"); } catch {}
  if (previousRuntime && previousRuntime.cleanShutdown === false && previousRuntime.runId !== runId) {
    const ageMs = Date.now() - Number(previousRuntime.heartbeatAt || 0);
    if (ageMs >= 0 && ageMs < 30 * 60 * 1000) {
      record("runtime-unclean-restart", "warning", {
        previousRunId: previousRuntime.runId,
        previousHeartbeatAt: previousRuntime.heartbeatAt,
        ageMs,
        previousRoute: previousRuntime.route,
        previousVisibility: previousRuntime.visibility,
      }, "O WebView iniciou sem registrar encerramento limpo na execução anterior.");
    }
  }

  writeRuntime(false);
  record("blackbox-start", "info", { version: VERSION, runId, wasDiscarded: Boolean(document.wasDiscarded) }, "Caixa-preta iniciada.");

  const heartbeat = window.setInterval(() => writeRuntime(false), 10000);

  function cleanShutdown(kind) {
    record("runtime-shutdown", "info", { kind }, "Encerramento do runtime observado.");
    flushPersist();
    writeRuntime(true);
  }
  window.addEventListener("pagehide", () => cleanShutdown("pagehide"));
  window.addEventListener("beforeunload", () => cleanShutdown("beforeunload"));

  document.addEventListener("visibilitychange", () => {
    record("visibility", "info", { state: document.visibilityState }, `Visibilidade: ${document.visibilityState}`);
    writeRuntime(false);
  });
  window.addEventListener("online", () => record("network", "info", { online: true }, "Rede disponível."));
  window.addEventListener("offline", () => record("network", "warning", { online: false }, "Rede indisponível."));

  window.addEventListener("error", (event) => {
    record("javascript-error", "error", {
      file: event.filename ? safePath(event.filename) : null,
      line: event.lineno || null,
      column: event.colno || null,
      name: event.error?.name || "Error",
      stack: clamp(event.error?.stack || "", 3200),
    }, event.message || event.error?.message || "Erro JavaScript");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const name = String(reason?.name || "UnhandledPromiseRejection");
    if (name === "AbortError") {
      record("request-cancelled", "info", {
        name,
        stack: clamp(reason?.stack || "", 1800),
      }, reason?.message || "Requisição cancelada durante transição de tela.");
      event.preventDefault();
      return;
    }
    record("unhandled-rejection", "error", {
      name,
      stack: clamp(reason?.stack || "", 3200),
    }, reason?.message || String(reason || "Promise rejeitada sem tratamento"));
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a[href],button,[role='button'],input[type='submit']") : null;
    if (!target) return;
    const href = target instanceof HTMLAnchorElement ? safePath(target.href) : null;
    record("interaction", "info", {
      tag: target.tagName.toLowerCase(),
      role: target.getAttribute("role"),
      href,
      ariaLabel: clamp(target.getAttribute("aria-label") || "", 160),
      dataAction: clamp(target.getAttribute("data-action") || target.getAttribute("data-sl-nav-motion") || "", 120),
    }, "Ação de interface.");
  }, true);

  const previousFetch = window.fetch.bind(window);
  window.fetch = async function santaLuziaBlackBoxFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const path = safePath(url);
    const started = performance.now();
    const apiLike = (() => { try { return new URL(url, location.href).pathname.startsWith("/api/"); } catch { return false; } })();
    if (apiLike) record("fetch-start", "info", { method, path }, `${method} ${path}`);
    try {
      const response = await previousFetch(input, init);
      const durationMs = Math.round(performance.now() - started);
      if (apiLike) record("fetch-end", response.ok && durationMs < SLOW_FETCH_MS ? "info" : response.ok ? "warning" : "error", {
        method, path, status: response.status, durationMs, slow: durationMs >= SLOW_FETCH_MS,
      }, `${method} ${path} → ${response.status}`);
      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      if (apiLike) record("fetch-throw", error?.name === "AbortError" ? "info" : "error", {
        method, path, durationMs, name: error?.name || "Error", stack: clamp(error?.stack || "", 1500),
      }, error?.message || `${method} ${path} falhou`);
      throw error;
    }
  };

  function traceName(target) { return clamp(`SL route ${target}`, 110); }
  window.addEventListener("santa-luzia:route-start", (event) => {
    const target = String(event?.detail?.target || `${location.pathname}${location.search}${location.hash}`);
    const cookie = Math.abs((Date.now() + ++sequence) % 2147483000) || 1;
    routeTraces.set(target, cookie);
    record("route-start", "info", { target, cookie }, `Início de rota ${target}`);
    const native = plugin();
    if (native?.beginTrace) void native.beginTrace({ name: traceName(target), cookie }).catch(() => {});
    scheduleVisualSamples("route-start");
  });
  window.addEventListener("santa-luzia:route-settled", (event) => {
    const target = String(event?.detail?.target || `${location.pathname}${location.search}${location.hash}`);
    const cookie = routeTraces.get(target);
    routeTraces.delete(target);
    record("route-settled", "info", { target, cookie: cookie || null }, `Rota estabilizada ${target}`);
    const native = plugin();
    if (cookie && native?.endTrace) void native.endTrace({ name: traceName(target), cookie }).catch(() => {});
    scheduleVisualSamples("route-settled");
  });

  function visualState(trigger) {
    const root = document.getElementById("root");
    if (!root) {
      record("visual-blank-frame", "error", { trigger, reason: "root-missing" }, "Elemento raiz da interface ausente.");
      return;
    }
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    const state = {
      trigger,
      childCount: root.childElementCount,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity || "1"),
    };
    if (root.childElementCount === 0 || style.display === "none" || style.visibility === "hidden" || state.opacity < 0.08 || rect.height < 16) {
      record("visual-blank-frame", "error", state, "Quadro visual vazio/oculto detectado durante a navegação.");
    }
  }

  function scheduleVisualSamples(trigger) {
    visualState(`${trigger}:now`);
    requestAnimationFrame(() => visualState(`${trigger}:raf1`));
    requestAnimationFrame(() => requestAnimationFrame(() => visualState(`${trigger}:raf2`)));
    window.setTimeout(() => visualState(`${trigger}:100ms`), 100);
  }

  function observeRoot() {
    const root = document.getElementById("root");
    if (!root || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.slRouteTransition === "running") scheduleVisualSamples("root-mutation");
    });
    observer.observe(root, { childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeRoot, { once: true });
  else observeRoot();

  let layoutShiftBucket = null;
  let layoutShiftTimer = 0;
  function flushLayoutShifts() {
    if (!layoutShiftBucket) return;
    const bucket = layoutShiftBucket;
    layoutShiftBucket = null;
    layoutShiftTimer = 0;
    record("layout-shift-burst", "warning", bucket, `Mudanças visuais agrupadas: ${bucket.count} ocorrência(s).`);
  }

  try {
    const supported = PerformanceObserver.supportedEntryTypes || [];
    if (supported.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (entry.duration >= 120) record("long-task", "warning", { durationMs: Math.round(entry.duration), startTime: Math.round(entry.startTime) }, "Tarefa longa bloqueou a interface.");
      });
      observer.observe({ entryTypes: ["longtask"] });
    }
    if (supported.includes("layout-shift")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const value = Number(entry.value || 0);
          if (entry.hadRecentInput || value < 0.08) continue;
          const now = performance.now();
          if (!layoutShiftBucket) {
            layoutShiftBucket = { count: 0, totalValue: 0, maxValue: 0, firstStartTime: Math.round(entry.startTime), lastStartTime: Math.round(entry.startTime) };
          }
          layoutShiftBucket.count += 1;
          layoutShiftBucket.totalValue = Number((layoutShiftBucket.totalValue + value).toFixed(4));
          layoutShiftBucket.maxValue = Math.max(layoutShiftBucket.maxValue, value);
          layoutShiftBucket.lastStartTime = Math.round(entry.startTime);
          layoutShiftBucket.lastObservedAt = Math.round(now);
          if (layoutShiftTimer) window.clearTimeout(layoutShiftTimer);
          layoutShiftTimer = window.setTimeout(flushLayoutShifts, 1200);
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    }
  } catch {}

  async function memorySample() {
    const detail = {};
    try {
      if (performance.memory) {
        detail.js = {
          usedJSHeapSize: Number(performance.memory.usedJSHeapSize || 0),
          totalJSHeapSize: Number(performance.memory.totalJSHeapSize || 0),
          jsHeapSizeLimit: Number(performance.memory.jsHeapSizeLimit || 0),
        };
      }
    } catch {}
    try {
      const native = plugin();
      if (native?.memorySnapshot) detail.native = await native.memorySnapshot();
    } catch (error) { detail.nativeError = clamp(error?.message || error, 300); }
    const limit = Number(detail.js?.jsHeapSizeLimit || 0);
    const used = Number(detail.js?.usedJSHeapSize || 0);
    const pressure = limit > 0 && used / limit >= 0.75;
    const lowSystem = Boolean(detail.native?.systemLowMemory);
    record("memory-sample", pressure || lowSystem ? "warning" : "info", { ...detail, pressureRatio: limit ? Number((used / limit).toFixed(3)) : null }, pressure || lowSystem ? "Pressão de memória detectada." : "Amostra de memória.");
  }
  const memoryTimer = window.setInterval(() => { if (document.visibilityState === "visible") void memorySample(); }, 30000);
  window.setTimeout(() => void memorySample(), 4000);

  async function collectNativeStartup() {
    const native = plugin();
    if (!native?.getSnapshot) return null;
    try {
      const snapshot = await native.getSnapshot();
      const fatals = Array.isArray(snapshot?.fatalCrashes) ? snapshot.fatalCrashes : [];
      const latestFatal = fatals[fatals.length - 1];
      if (latestFatal?.timestamp) {
        let lastFatalSeen = 0;
        try { lastFatalSeen = Number(localStorage.getItem(LAST_FATAL_KEY) || 0); } catch {}
        if (Number(latestFatal.timestamp) > lastFatalSeen) {
          record("previous-fatal-exception", "error", {
            timestamp: latestFatal.timestamp,
            pid: latestFatal.pid,
            threadName: latestFatal.threadName,
            threadId: latestFatal.threadId,
            exceptionClass: latestFatal.exceptionClass,
            message: latestFatal.message,
            stackTrace: clamp(latestFatal.stackTrace || "", 3200),
            ageMs: Math.max(0, Date.now() - Number(latestFatal.timestamp)),
          }, `${latestFatal.exceptionClass || "Exceção fatal"}: ${latestFatal.message || "sem mensagem"}`);
          try { localStorage.setItem(LAST_FATAL_KEY, String(latestFatal.timestamp)); } catch {}
        }
      }

      const exits = Array.isArray(snapshot?.processExits) ? snapshot.processExits : [];
      const latest = exits.find((item) => item && !item.error);
      if (latest?.timestamp) {
        let lastSeen = 0;
        try { lastSeen = Number(localStorage.getItem(LAST_EXIT_KEY) || 0); } catch {}
        if (Number(latest.timestamp) > lastSeen) {
          const severe = ["CRASH", "CRASH_NATIVE", "ANR", "LOW_MEMORY", "INITIALIZATION_FAILURE", "EXCESSIVE_RESOURCE_USAGE", "SIGNALED"].includes(String(latest.reasonLabel || ""));
          record("previous-process-exit", severe ? "error" : "warning", {
            ...latest,
            ageMs: Math.max(0, Date.now() - Number(latest.timestamp)),
          }, `Processo anterior: ${latest.reasonLabel || latest.reason}`);
          try { localStorage.setItem(LAST_EXIT_KEY, String(latest.timestamp)); } catch {}
        }
      }
      return snapshot;
    } catch (error) {
      record("native-diagnostics-error", "warning", { name: error?.name || "Error" }, error?.message || "Falha ao consultar diagnóstico nativo.");
      return null;
    }
  }
  window.setTimeout(() => void collectNativeStartup(), 1200);

  async function snapshot() {
    let native = null;
    try { native = await plugin()?.getSnapshot?.(); } catch (error) { native = { available: false, error: clamp(error?.message || error, 400) }; }
    const now = Date.now();
    const list = events.slice(-MAX_EVENTS);
    return {
      version: VERSION,
      runId,
      generatedAt: new Date().toISOString(),
      currentRoute: `${location.pathname}${location.search}${location.hash}`,
      visibility: document.visibilityState,
      lastFiveMinutes: list.filter((event) => now - Number(event.at || 0) <= FIVE_MINUTES),
      events: list,
      native,
      capabilities: {
        applicationExitInfo: Boolean(native?.applicationExitInfoAvailable),
        fatalExceptionRecorder: Boolean(native?.fatalExceptionRecorderAvailable),
        perfettoMarkers: Boolean(native?.perfettoTraceMarkersAvailable),
        crashlytics: Boolean(native?.crashlyticsAvailable),
      },
      privacy: "Sem conteúdo de campos, corpos de requisição, cookies, tokens ou texto livre da interface. Registra somente metadados técnicos necessários para diagnóstico.",
    };
  }

  async function clear() {
    events = [];
    persist();
    try { localStorage.removeItem(LAST_EXIT_KEY); } catch {}
    try { localStorage.removeItem(LAST_FATAL_KEY); } catch {}
    try { await plugin()?.clearHistory?.(); } catch {}
    record("blackbox-cleared", "info", {}, "Histórico da caixa-preta reiniciado.");
  }

  window.SantaLuziaBlackBox = { version: VERSION, record, snapshot, clear, memorySample, collectNativeStartup };
  window.addEventListener("unload", () => {
    flushLayoutShifts();
    window.clearInterval(heartbeat);
    window.clearInterval(memoryTimer);
  });
})();
