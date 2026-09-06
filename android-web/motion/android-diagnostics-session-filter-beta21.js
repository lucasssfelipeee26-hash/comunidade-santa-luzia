"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaDiagnosticsSessionFilterBeta21";
  const SEEN_RUN_KEY = "santa-luzia:auditor:last-seen-run";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  function clamp(value, max = 300) {
    const text = String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function runStartFromId(runId) {
    const value = Number(String(runId || "").split("-")[0]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function eventAt(item) {
    return Number(item?.lastAt || item?.at || item?.firstAt || 0);
  }

  function routeOf(item) {
    return String(item?.route || item?.detail?.route || "").replace(/\?.*$/, "");
  }

  function eventSignature(item, source) {
    const type = String(item?.type || "unknown");
    const level = String(item?.level || "info");
    const route = routeOf(item);
    const detail = item?.detail || {};
    if (type === "fetch" || type === "fetch-end") {
      return `http|${detail.method || item?.method || "GET"}|${String(detail.path || item?.path || item?.url || "").replace(/\?.*$/, "")}|${detail.status || item?.status || 0}|${level}`;
    }
    if (type === "fetch-throw") return `fetch-throw|${detail.method || "GET"}|${detail.path || ""}|${detail.name || "Error"}`;
    if (type === "javascript-error" || type === "unhandled-rejection" || type === "previous-fatal-exception") {
      return `${type}|${detail.name || detail.exceptionClass || "Error"}|${clamp(item?.message, 180)}|${route}`;
    }
    if (type === "document-growth-burst") return `${type}|${route}|${Math.round(Number(detail.maxStepPx || 0) / 100) * 100}`;
    if (type === "resize-loop-burst") return `${type}|${route}|${Math.round(Number(detail.count || 0) / 10) * 10}`;
    return `${source}|${type}|${route}|${clamp(item?.message || item?.signature || "", 180)}`;
  }

  function uniqueEvents(items, source) {
    const map = new Map();
    for (const item of items) {
      const key = eventSignature(item, source);
      const existing = map.get(key);
      if (!existing || eventAt(item) >= eventAt(existing)) map.set(key, item);
    }
    return [...map.values()];
  }

  async function waitForReady() {
    const core = window.SantaLuziaAuditor;
    const blackBox = window.SantaLuziaBlackBox;
    if (!core || !blackBox || !core.santaLuziaAuditorBeta21Patched) {
      setTimeout(waitForReady, 120);
      return;
    }
    if (core.__beta21SessionFilterInstalled) return;
    core.__beta21SessionFilterInstalled = true;

    let runId = "";
    try { runId = String((await blackBox.snapshot())?.runId || ""); } catch {}
    const runStartedAt = runStartFromId(runId);

    // Não apagamos mais o histórico quando nasce uma nova execução. O relatório
    // separa execução atual de histórico; o Diagnostic Ledger preserva falhas
    // importantes entre reinícios e atualizações do APK.
    try {
      const previousRun = localStorage.getItem(SEEN_RUN_KEY) || "";
      if (runId && previousRun !== runId) {
        localStorage.setItem(SEEN_RUN_KEY, runId);
        core.add?.("auditor-session-boundary", "info", {
          runId,
          previousRunId: previousRun || null,
          historicalCountersExcluded: true,
          persistentLedgerPreserved: true,
        });
      }
    } catch {}

    const originalSnapshot = core.snapshot.bind(core);
    core.snapshot = async function beta21SessionSnapshot() {
      const report = await originalSnapshot();
      const box = report.blackBox || await blackBox.snapshot().catch(() => null);
      const currentRunId = String(box?.runId || runId || "");
      const exactRunStartAt = runStartFromId(currentRunId) || runStartedAt;
      const allBlackEvents = Array.isArray(box?.events) ? box.events : [];
      const currentBlackEvents = currentRunId
        ? allBlackEvents.filter((item) => String(item?.runId || "") === currentRunId)
        : allBlackEvents.filter((item) => !exactRunStartAt || Number(item?.at || 0) >= exactRunStartAt - 1500);
      const historicalBlackEvents = allBlackEvents.filter((item) => !currentBlackEvents.includes(item));
      const currentRecent = Array.isArray(box?.lastFiveMinutes)
        ? box.lastFiveMinutes.filter((item) => !currentRunId || String(item?.runId || "") === currentRunId)
        : [];

      const auditorEvents = Array.isArray(report.events) ? report.events : [];
      const currentAuditorEvents = exactRunStartAt
        ? auditorEvents.filter((item) => eventAt(item) >= exactRunStartAt - 1500)
        : auditorEvents;
      const historicalAuditorEvents = auditorEvents.filter((item) => !currentAuditorEvents.includes(item));

      const forensics = window.SantaLuziaVisualForensics?.snapshot?.() || null;
      const currentForensicIncidents = Array.isArray(forensics?.currentRunIncidents) ? forensics.currentRunIncidents : [];
      const activeForensicIncidents = Array.isArray(forensics?.activeIncidents) ? forensics.activeIncidents : [];
      const forensicTimeline = Array.isArray(forensics?.continuousTimeline) ? forensics.continuousTimeline : [];
      const ledger = window.SantaLuziaDiagnosticLedger?.snapshot?.(currentRunId) || null;

      const combinedErrors = uniqueEvents([
        ...currentAuditorEvents.filter((item) => item?.level === "error"),
        ...currentBlackEvents.filter((item) => item?.level === "error"),
      ], "combined-error");
      const combinedWarnings = uniqueEvents([
        ...currentAuditorEvents.filter((item) => item?.level === "warning"),
        ...currentBlackEvents.filter((item) => item?.level === "warning"),
      ], "combined-warning");
      const slowRequests = uniqueEvents([
        ...currentAuditorEvents.filter((item) => item?.type === "fetch" && item?.slow),
        ...currentBlackEvents.filter((item) => item?.type === "fetch-end" && Boolean(item?.detail?.slow)),
      ], "slow").length;
      const lowFpsSamples = currentAuditorEvents.filter((item) => item?.type === "fps-sample" && Number(item?.fps || 60) < 45).length;

      const currentVisualWarnings = currentBlackEvents.filter((item) => [
        "layout-shift-burst",
        "unexpected-scroll-burst",
        "document-growth-burst",
        "resize-loop-burst",
        "visual-blank-frame",
      ].includes(String(item?.type || "")));

      const persistent = ledger?.counters || {};
      const watch = forensics?.watch || {};

      return {
        ...report,
        summary: {
          ...(report.summary || {}),
          errors: combinedErrors.length,
          warnings: combinedWarnings.length,
          slowRequests,
          lowFpsSamples,
          blackBoxEvents: currentBlackEvents.length,
          blackBoxRecentEvents: currentRecent.length,
          blackBoxHistoricalEvents: historicalBlackEvents.length,
          forensicIncidents: currentForensicIncidents.length,
          forensicActiveIncidents: activeForensicIncidents.length,
          forensicTimelineEntries: forensicTimeline.length,
          visualWarnings: currentVisualWarnings.length,
          persistentDiagnosticSignatures: Number(persistent.signatures || 0),
          persistentHistoricalSignatures: Number(persistent.historicalSignatures || 0),
          persistentUnresolvedErrors: Number(persistent.unresolvedErrors || 0),
          persistentUnresolvedWarnings: Number(persistent.unresolvedWarnings || 0),
          sentinelSamples: Number(watch.totalSamples || 0),
          sentinelStateChanges: Number(watch.stateChanges || 0),
          sentinelInteractions: Number(watch.interactions || 0),
          countingMode: "current-run-combined-unique-signatures",
        },
        events: currentAuditorEvents,
        blackBox: box ? {
          ...box,
          events: currentBlackEvents,
          lastFiveMinutes: currentRecent,
          history: {
            excludedFromCurrentCounters: true,
            retainedEvents: historicalBlackEvents.length,
            latestEvents: historicalBlackEvents.slice(-100),
          },
        } : box,
        visualForensics: forensics,
        diagnosticLedger: ledger,
        currentRunFindings: {
          errors: combinedErrors,
          warnings: combinedWarnings,
          visualWarnings: currentVisualWarnings,
        },
        counting: {
          ...(report.counting || {}),
          mode: "current-run-combined-unique-signatures",
          currentRunId,
          runStartAt: exactRunStartAt || null,
          historicalBlackBoxExcluded: true,
          historicalAuditorExcluded: true,
          historicalAuditorEventsRetained: historicalAuditorEvents.length,
          persistentLedgerPreserved: Boolean(ledger),
          note: "Contadores principais combinam Auditor + Caixa-preta somente da execução atual, removendo duplicações. Falhas históricas importantes permanecem no Diagnostic Ledger e não somem após reinício/atualização do APK.",
        },
        diagnosticsArchitecture: {
          ...(report.diagnosticsArchitecture || {}),
          currentRunIsolation: true,
          blackBox: true,
          persistentDiagnosticLedger: Boolean(window.SantaLuziaDiagnosticLedger),
          visualForensics: Boolean(window.SantaLuziaVisualForensics),
          visualForensicsMode: forensics?.mode || "privacy-preserving-visual-timeline+continuous-sentinel",
          continuousVisualSentinel: Boolean(forensics?.watch?.alwaysOnWhileAppRunning),
          sentinelRollingWindowMs: Number(forensics?.watch?.rollingWindowMs || 0),
          sentinelSamplingMs: Number(forensics?.watch?.samplingMs || 0),
        },
      };
    };

    core.add?.("diagnostics-session-filter-ready", "info", {
      runId,
      currentRunIsolation: true,
      historicalDataPreserved: true,
      persistentDiagnosticLedger: Boolean(window.SantaLuziaDiagnosticLedger),
      visualForensics: Boolean(window.SantaLuziaVisualForensics),
      continuousVisualSentinel: Boolean(window.SantaLuziaVisualForensics?.engine),
    });
  }

  waitForReady();
})();