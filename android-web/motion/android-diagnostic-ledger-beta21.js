"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaDiagnosticLedgerBeta21";
  const STORAGE_KEY = "santa-luzia:diagnostic-ledger:v1";
  const BLACKBOX_KEY = "santa-luzia:blackbox:v1";
  const MAX_SIGNATURES = 320;
  const MAX_SAMPLES_PER_SIGNATURE = 8;
  const MAX_RECENT_OCCURRENCES = 640;
  const IMPORTANT_TYPES = new Set([
    "javascript-error",
    "unhandled-rejection",
    "previous-fatal-exception",
    "previous-process-exit",
    "runtime-unclean-restart",
    "visual-blank-frame",
    "layout-shift-burst",
    "unexpected-scroll-burst",
    "document-growth-burst",
    "resize-loop-burst",
    "long-task",
    "native-diagnostics-error",
    "fetch-throw",
  ]);

  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let state = readState();
  let lastCapturedId = String(state?.lastCapturedId || "");
  let persistTimer = 0;

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
    if (typeof value === "string") return clamp(value, 1600);
    if (depth >= 3) return "[truncado]";
    if (Array.isArray(value)) return value.slice(0, 18).map((item) => safeValue(item, depth + 1));
    if (typeof value === "object") {
      const out = {};
      for (const [key, item] of Object.entries(value).slice(0, 28)) {
        if (/password|senha|token|authorization|cookie|body|payload|content/i.test(key)) out[key] = "[redigido]";
        else out[key] = safeValue(item, depth + 1);
      }
      return out;
    }
    return clamp(value);
  }

  function emptyState() {
    return {
      version: VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastCapturedId: "",
      signatures: [],
      recentOccurrences: [],
    };
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return emptyState();
      return {
        version: VERSION,
        createdAt: Number(parsed.createdAt || Date.now()),
        updatedAt: Number(parsed.updatedAt || Date.now()),
        lastCapturedId: String(parsed.lastCapturedId || ""),
        signatures: Array.isArray(parsed.signatures) ? parsed.signatures.slice(-MAX_SIGNATURES) : [],
        recentOccurrences: Array.isArray(parsed.recentOccurrences) ? parsed.recentOccurrences.slice(-MAX_RECENT_OCCURRENCES) : [],
      };
    } catch { return emptyState(); }
  }

  function schedulePersist() {
    if (persistTimer) return;
    persistTimer = window.setTimeout(persistNow, 500);
  }

  function persistNow() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = 0;
    }
    state.updatedAt = Date.now();
    state.lastCapturedId = lastCapturedId;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      state.recentOccurrences = state.recentOccurrences.slice(-240);
      state.signatures = state.signatures.slice(-180);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }
  }

  function normalizedPath(value) {
    return clamp(String(value || "").replace(/\?.*$/, ""), 180);
  }

  function signatureFor(event) {
    const detail = event?.detail || {};
    const type = String(event?.type || "unknown");
    const route = normalizedPath(event?.route || "");
    if (type === "fetch-end") return `${type}|${detail.method || "GET"}|${normalizedPath(detail.path)}|${detail.status || 0}`;
    if (type === "fetch-throw") return `${type}|${detail.method || "GET"}|${normalizedPath(detail.path)}|${detail.name || "Error"}`;
    if (type === "javascript-error" || type === "unhandled-rejection" || type === "previous-fatal-exception") {
      return `${type}|${detail.name || detail.exceptionClass || "Error"}|${clamp(event?.message || "", 220)}|${route}`;
    }
    if (type === "document-growth-burst") return `${type}|${route}|${Math.round(Number(detail.maxStepPx || 0) / 100) * 100}`;
    if (type === "resize-loop-burst") return `${type}|${route}|${Math.round(Number(detail.count || 0) / 10) * 10}`;
    if (type === "layout-shift-burst") return `${type}|${route}|${Math.round(Number(detail.maxValue || 0) * 10) / 10}`;
    return `${type}|${route}|${clamp(event?.message || "", 220)}`;
  }

  function isImportant(event) {
    if (!event || !event.type) return false;
    if (event.level === "error" || event.level === "warning") return true;
    if (IMPORTANT_TYPES.has(String(event.type))) return true;
    if (event.type === "fetch-end" && Number(event?.detail?.status || 0) >= 400) return true;
    return false;
  }

  function capture(event) {
    if (!isImportant(event)) return false;
    const eventId = String(event.id || "");
    if (eventId && eventId === lastCapturedId) return false;
    const now = Number(event.at || Date.now());
    const signature = signatureFor(event);
    const safeEvent = {
      id: eventId,
      at: now,
      runId: String(event.runId || ""),
      type: clamp(event.type, 90),
      level: event.level === "error" ? "error" : event.level === "warning" ? "warning" : "info",
      route: clamp(event.route || "", 220),
      message: clamp(event.message || "", 900),
      detail: safeValue(event.detail || {}),
    };

    let item = state.signatures.find((entry) => entry.signature === signature);
    if (!item) {
      item = {
        signature,
        type: safeEvent.type,
        level: safeEvent.level,
        route: safeEvent.route,
        message: safeEvent.message,
        firstAt: now,
        lastAt: now,
        occurrences: 0,
        firstRunId: safeEvent.runId,
        lastRunId: safeEvent.runId,
        seenRunIds: [],
        samples: [],
        status: "observed",
      };
      state.signatures.push(item);
    }
    item.lastAt = now;
    item.lastRunId = safeEvent.runId;
    item.occurrences = Number(item.occurrences || 0) + 1;
    if (safeEvent.level === "error") item.level = "error";
    if (safeEvent.message) item.message = safeEvent.message;
    if (safeEvent.route) item.route = safeEvent.route;
    item.seenRunIds = [...new Set([...(item.seenRunIds || []), safeEvent.runId].filter(Boolean))].slice(-20);
    item.samples = [...(item.samples || []), safeEvent].slice(-MAX_SAMPLES_PER_SIGNATURE);

    state.signatures.sort((a, b) => Number(a.lastAt || 0) - Number(b.lastAt || 0));
    state.signatures = state.signatures.slice(-MAX_SIGNATURES);
    state.recentOccurrences.push({ signature, ...safeEvent });
    state.recentOccurrences = state.recentOccurrences.slice(-MAX_RECENT_OCCURRENCES);
    lastCapturedId = eventId || lastCapturedId;
    schedulePersist();
    return true;
  }

  function latestBlackBoxEvent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BLACKBOX_KEY) || "null");
      const list = Array.isArray(parsed?.events) ? parsed.events : [];
      return list[list.length - 1] || null;
    } catch { return null; }
  }

  function captureLatest() {
    const event = latestBlackBoxEvent();
    if (event) capture(event);
  }

  function backfillCurrentRing() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BLACKBOX_KEY) || "null");
      const list = Array.isArray(parsed?.events) ? parsed.events : [];
      for (const event of list) capture(event);
      persistNow();
    } catch {}
  }

  function runStartFromId(runId) {
    const first = Number(String(runId || "").split("-")[0]);
    return Number.isFinite(first) && first > 0 ? first : 0;
  }

  function snapshot(currentRunId = "") {
    persistNow();
    const runStartAt = runStartFromId(currentRunId);
    const signatures = state.signatures.slice().sort((a, b) => Number(b.lastAt || 0) - Number(a.lastAt || 0));
    const current = currentRunId ? signatures.filter((item) => (item.seenRunIds || []).includes(currentRunId) || item.lastRunId === currentRunId) : [];
    const historical = currentRunId ? signatures.filter((item) => !current.includes(item)) : signatures;
    const unresolvedErrors = signatures.filter((item) => item.level === "error" && item.status !== "resolved");
    const unresolvedWarnings = signatures.filter((item) => item.level === "warning" && item.status !== "resolved");
    return {
      version: VERSION,
      mode: "persistent-diagnostic-ledger",
      generatedAt: new Date().toISOString(),
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      currentRunId,
      currentRunStartAt: runStartAt || null,
      counters: {
        signatures: signatures.length,
        currentRunSignatures: current.length,
        historicalSignatures: historical.length,
        unresolvedErrors: unresolvedErrors.length,
        unresolvedWarnings: unresolvedWarnings.length,
        retainedOccurrences: state.recentOccurrences.length,
      },
      currentRun: current,
      historical: historical,
      recentOccurrences: state.recentOccurrences.slice(-160),
      policy: "Falhas e avisos importantes persistem entre execuções e atualizações do APK. O histórico não entra nos contadores da execução atual, mas permanece disponível para comparação e regressão até limpeza manual.",
    };
  }

  function markResolved(signature, note = "") {
    const item = state.signatures.find((entry) => entry.signature === signature);
    if (!item) return false;
    item.status = "resolved";
    item.resolvedAt = Date.now();
    item.resolutionNote = clamp(note, 300);
    persistNow();
    return true;
  }

  function clearAll() {
    state = emptyState();
    lastCapturedId = "";
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  window.addEventListener("santa-luzia:blackbox-event", captureLatest);
  window.addEventListener("pagehide", persistNow);
  window.addEventListener("beforeunload", persistNow);
  window.setTimeout(backfillCurrentRing, 120);
  window.setInterval(persistNow, 15000);

  window.SantaLuziaDiagnosticLedger = {
    version: VERSION,
    captureLatest,
    backfillCurrentRing,
    snapshot,
    markResolved,
    clearAll,
  };
})();