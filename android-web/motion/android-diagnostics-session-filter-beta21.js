"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaDiagnosticsSessionFilterBeta21";
  const RESET_KEY = "santa-luzia:auditor:last-reset-run";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

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

    try {
      const lastReset = localStorage.getItem(RESET_KEY) || "";
      if (runId && lastReset !== runId) {
        core.clear?.();
        localStorage.setItem(RESET_KEY, runId);
        core.add?.("auditor-session-reset", "info", {
          runId,
          reason: "new-runtime",
          historicalCountersExcluded: true,
        });
      }
    } catch {}

    const originalSnapshot = core.snapshot.bind(core);
    core.snapshot = async function beta21SessionSnapshot() {
      const report = await originalSnapshot();
      const box = report.blackBox || await blackBox.snapshot().catch(() => null);
      const currentRunId = String(box?.runId || runId || "");
      const allBlackEvents = Array.isArray(box?.events) ? box.events : [];
      const currentBlackEvents = currentRunId ? allBlackEvents.filter((item) => String(item?.runId || "") === currentRunId) : allBlackEvents;
      const historicalBlackEvents = currentRunId ? allBlackEvents.filter((item) => String(item?.runId || "") !== currentRunId) : [];
      const currentRecent = Array.isArray(box?.lastFiveMinutes)
        ? box.lastFiveMinutes.filter((item) => !currentRunId || String(item?.runId || "") === currentRunId)
        : [];

      const runStartAt = currentBlackEvents.length
        ? Math.min(...currentBlackEvents.map((item) => Number(item?.at || Number.MAX_SAFE_INTEGER)))
        : 0;
      const auditorEvents = Array.isArray(report.events) ? report.events : [];
      const currentAuditorEvents = runStartAt
        ? auditorEvents.filter((item) => Number(item?.lastAt || item?.at || 0) >= runStartAt - 1500)
        : auditorEvents;

      const forensics = window.SantaLuziaVisualForensics?.snapshot?.() || null;
      const currentForensicIncidents = Array.isArray(forensics?.currentRunIncidents) ? forensics.currentRunIncidents : [];
      const activeForensicIncidents = Array.isArray(forensics?.activeIncidents) ? forensics.activeIncidents : [];

      const errors = currentAuditorEvents.filter((item) => item?.level === "error").length;
      const warnings = currentAuditorEvents.filter((item) => item?.level === "warning").length;
      const slowRequests = currentAuditorEvents.filter((item) => item?.type === "fetch" && item?.slow).length;
      const lowFpsSamples = currentAuditorEvents.filter((item) => item?.type === "fps-sample" && Number(item?.fps || 60) < 45).length;

      return {
        ...report,
        summary: {
          ...(report.summary || {}),
          errors,
          warnings,
          slowRequests,
          lowFpsSamples,
          blackBoxEvents: currentBlackEvents.length,
          blackBoxRecentEvents: currentRecent.length,
          blackBoxHistoricalEvents: historicalBlackEvents.length,
          forensicIncidents: currentForensicIncidents.length,
          forensicActiveIncidents: activeForensicIncidents.length,
          countingMode: "current-run-unique-signatures",
        },
        events: currentAuditorEvents,
        blackBox: box ? {
          ...box,
          events: currentBlackEvents,
          lastFiveMinutes: currentRecent,
          history: {
            excludedFromCounters: true,
            retainedEvents: historicalBlackEvents.length,
            latestEvents: historicalBlackEvents.slice(-80),
          },
        } : box,
        visualForensics: forensics,
        counting: {
          ...(report.counting || {}),
          mode: "current-run-unique-signatures",
          currentRunId,
          runStartAt: runStartAt || null,
          historicalBlackBoxExcluded: true,
          historicalAuditorExcluded: true,
          note: "Contadores principais usam somente a execução atual. Histórico anterior fica separado para correlação de crashes e não aumenta erros/avisos atuais.",
        },
        diagnosticsArchitecture: {
          ...(report.diagnosticsArchitecture || {}),
          currentRunIsolation: true,
          visualForensics: Boolean(window.SantaLuziaVisualForensics),
          visualForensicsMode: "privacy-preserving-visual-timeline",
        },
      };
    };

    core.add?.("diagnostics-session-filter-ready", "info", {
      runId,
      currentRunIsolation: true,
      visualForensics: Boolean(window.SantaLuziaVisualForensics),
    });
  }

  waitForReady();
})();
