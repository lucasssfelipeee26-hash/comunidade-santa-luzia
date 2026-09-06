"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaAuditorBeta21Patched";
  const STORAGE_KEY = "santa-luzia:auditor:v1";
  const CLEAN_VERSION_KEY = "santa-luzia:auditor:last-clean-version";
  let preciseRouteStart = 0;
  let preciseRouteTarget = "";

  function eventSignature(event) {
    const type = String(event?.type || "unknown");
    const route = String(event?.route || "");
    if (type === "javascript-error") return `${type}|${event?.message || ""}|${event?.file || ""}|${event?.line || ""}`;
    if (type === "unhandled-rejection") return `${type}|${event?.name || ""}|${event?.message || ""}`;
    if (type === "fetch" || type === "fetch-error") return `${type}|${event?.method || "GET"}|${event?.path || ""}|${event?.status || 0}|${route}`;
    if (type === "fps-sample") return `${type}|${route}|${Number(event?.fps || 0) < 45 ? "low" : "ok"}`;
    if (type === "scroll-jump" || type === "missing-icons" || type === "icon-audit") return `${type}|${route}`;
    if (type === "local-db-health") return `${type}|${event?.ok === false ? "bad" : "ok"}`;
    if (type === "route-transition" || type === "route-transition-v2") return `${type}|${event?.pathname || route}`;
    return `${type}|${event?.level || "info"}|${route}`;
  }

  function isKnownBackgroundAbort(event) {
    if (!event || String(event?.name || "") !== "AbortError") return false;
    const path = String(event?.path || "");
    return path === "/api/app/status"
      || path.includes("raw.githubusercontent.com/lucasssfelipeee26-hash/comunidade-santa-luzia/");
  }

  function isExpectedNoise(event) {
    if (!event) return true;
    const type = String(event.type || "");
    const path = String(event.path || "");
    const route = String(event.route || "");
    const status = Number(event.status || 0);

    if ((type === "auditor-ready" || type === "scroll-stability") && event.version && event.version !== VERSION) return true;
    if (type === "fetch" && status === 401 && (route === "/" || route.startsWith("/area-restrita/login"))) return true;
    if (type === "fetch" && status === 404 && path === "/api/configuracao/diagnostico") return true;
    if (type === "route-transition") return true;
    if (type === "fetch-error" && isKnownBackgroundAbort(event)) return true;
    return false;
  }

  function compactEvents(events) {
    const list = Array.isArray(events) ? events : [];
    const bySignature = new Map();
    for (const raw of list) {
      if (isExpectedNoise(raw)) continue;
      const event = { ...raw };
      const signature = eventSignature(event);
      const current = bySignature.get(signature);
      if (!current) {
        bySignature.set(signature, {
          ...event,
          occurrences: Number(event.occurrences || 1),
          firstAt: Number(event.firstAt || event.at || Date.now()),
          lastAt: Number(event.lastAt || event.at || Date.now()),
          signature,
        });
        continue;
      }
      current.occurrences = Number(current.occurrences || 1) + Number(event.occurrences || 1);
      current.firstAt = Math.min(Number(current.firstAt || current.at || Date.now()), Number(event.firstAt || event.at || Date.now()));
      current.lastAt = Math.max(Number(current.lastAt || current.at || 0), Number(event.lastAt || event.at || 0));
      current.at = current.lastAt;
      for (const [key, value] of Object.entries(event)) if (value !== undefined) current[key] = value;
      current.signature = signature;
    }
    return [...bySignature.values()]
      .sort((a, b) => Number(a.lastAt || a.at || 0) - Number(b.lastAt || b.at || 0))
      .slice(-260);
  }

  function persistCompacted(events) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), events })); } catch {}
  }

  function suspiciousExit(item) {
    return ["CRASH", "CRASH_NATIVE", "ANR", "LOW_MEMORY", "INITIALIZATION_FAILURE", "EXCESSIVE_RESOURCE_USAGE", "SIGNALED"].includes(String(item?.reasonLabel || ""));
  }

  function uniqueSummary(events, original, deepResult, blackBox) {
    const processExits = Array.isArray(blackBox?.native?.processExits) ? blackBox.native.processExits.filter((item) => item && !item.error) : [];
    const blackEvents = Array.isArray(blackBox?.events) ? blackBox.events : [];
    const recent = Array.isArray(blackBox?.lastFiveMinutes) ? blackBox.lastFiveMinutes : [];
    return {
      ...original,
      errors: events.filter((event) => event?.level === "error").length,
      warnings: events.filter((event) => event?.level === "warning").length,
      slowRequests: events.filter((event) => event?.type === "fetch" && event?.slow).length,
      lowFpsSamples: events.filter((event) => event?.type === "fps-sample" && Number(event?.fps || 60) < 45).length,
      scrollJumps: events.filter((event) => event?.type === "scroll-jump").length,
      missingIconAudits: events.filter((event) => event?.type === "missing-icons").length,
      deepFindings: Number(deepResult?.summary?.findings || 0),
      deepErrors: Number(deepResult?.summary?.errors || 0),
      deepWarnings: Number(deepResult?.summary?.warnings || 0),
      blackBoxEvents: blackEvents.length,
      blackBoxRecentEvents: recent.length,
      processExits: processExits.length,
      suspiciousProcessExits: processExits.filter(suspiciousExit).length,
      crashlyticsAvailable: Boolean(blackBox?.capabilities?.crashlytics),
      perfettoMarkersAvailable: Boolean(blackBox?.capabilities?.perfettoMarkers),
      applicationExitInfoAvailable: Boolean(blackBox?.capabilities?.applicationExitInfo),
      countingMode: "unique-signatures",
    };
  }

  function reportName() {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}-${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
    return `Santa-Luzia-Diagnostico-${stamp}.json`;
  }

  async function browserDownload(fileName, content) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { ok: true, fileName, location: "download-browser", method: "browser" };
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }

  function installPreciseRouteAudit(core) {
    if (window.__santaLuziaBeta21RouteAudit) return;
    window.__santaLuziaBeta21RouteAudit = true;

    const begin = (event) => {
      preciseRouteStart = performance.now();
      preciseRouteTarget = String(event?.detail?.target || `${location.pathname}${location.search}${location.hash}`);
    };
    const finish = () => {
      if (!preciseRouteStart) return;
      const started = preciseRouteStart;
      const target = preciseRouteTarget;
      preciseRouteStart = 0;
      preciseRouteTarget = "";
      const durationMs = Math.round(performance.now() - started);
      core.add?.("route-transition-v2", durationMs > 700 ? "warning" : "info", {
        durationMs,
        pathname: location.pathname,
        target,
        precise: true,
      });
    };

    window.addEventListener("santa-luzia:route-start", begin);
    window.addEventListener("santa-luzia:route-settled", finish);
    window.addEventListener("popstate", () => {
      preciseRouteStart = performance.now();
      preciseRouteTarget = `${location.pathname}${location.search}${location.hash}`;
      requestAnimationFrame(() => requestAnimationFrame(finish));
    });
  }

  function patch() {
    const core = window.SantaLuziaAuditor;
    const deep = window.SantaLuziaDeepAudit;
    if (!core || !deep) { setTimeout(patch, 120); return; }
    if (core[FLAG]) return;
    core[FLAG] = true;

    try {
      if (localStorage.getItem(CLEAN_VERSION_KEY) !== VERSION) {
        core.clear();
        localStorage.setItem(CLEAN_VERSION_KEY, VERSION);
        localStorage.removeItem("santa-luzia:deep-audit:last:v1");
      }
    } catch {}

    installPreciseRouteAudit(core);

    const originalSnapshot = core.snapshot.bind(core);
    const originalGetEvents = core.getEvents?.bind(core);
    core.getEvents = () => compactEvents(originalGetEvents ? originalGetEvents() : []);

    core.snapshot = async function beta21Snapshot() {
      const report = await originalSnapshot();
      const deepResult = deep.getLast?.() || null;
      const blackBox = await window.SantaLuziaBlackBox?.snapshot?.().catch?.(() => null) || null;
      const events = compactEvents(report.events);
      persistCompacted(events);
      const summary = uniqueSummary(events, report.summary || {}, deepResult, blackBox);
      return {
        ...report,
        schema: "santa-luzia-diagnostico-v6",
        app: { ...(report.app || {}), version: VERSION },
        summary,
        events,
        deepAudit: deepResult,
        blackBox,
        processDiagnostics: blackBox?.native || null,
        glitchTip: deep.getGlitchTipStatus?.() || null,
        diagnosticsArchitecture: {
          auditor: true,
          deepScan: true,
          blackBox: Boolean(window.SantaLuziaBlackBox),
          applicationExitInfo: Boolean(blackBox?.capabilities?.applicationExitInfo),
          perfettoTraceMarkers: Boolean(blackBox?.capabilities?.perfettoMarkers),
          crashlyticsAdapter: true,
          crashlyticsActive: Boolean(blackBox?.capabilities?.crashlytics),
          crashlyticsNote: blackBox?.capabilities?.crashlytics
            ? "Firebase Crashlytics detectado e recebendo breadcrumbs/non-fatals."
            : "Adaptador pronto; ativação remota exige Firebase Crashlytics/google-services.json no build.",
        },
        counting: {
          mode: "unique-signatures",
          note: "Repetições do mesmo defeito incrementam occurrences. A caixa-preta mantém cronologia bruta dos últimos eventos e ApplicationExitInfo informa por que o processo anterior morreu.",
        },
        privacy: "Relatório técnico sem cookies, senhas, tokens, corpos de requisição ou texto de campos. Caixa-preta registra apenas metadados técnicos, rotas, tempos, estados visuais e motivos de saída do processo.",
      };
    };

    core.exportReport = async function beta21ExportReport() {
      try { await deep.run({ sendRemote: true }); } catch {}
      const report = await core.snapshot();
      const fileName = reportName();
      const content = JSON.stringify(report, null, 2);
      const native = window.Capacitor?.Plugins?.DiagnosticReport;
      let saved;
      if (native?.saveReport) {
        saved = await native.saveReport({ fileName, content });
        saved = { ...saved, method: "android-native" };
      } else saved = await browserDownload(fileName, content);
      core.add?.("report-exported", "info", {
        events: report.events.length,
        blackBoxEvents: report.blackBox?.events?.length || 0,
        processExits: report.processDiagnostics?.processExits?.length || 0,
        fileName,
        method: saved.method,
        beta21: true,
        uniqueErrors: report.summary.errors,
      });
      return { ...report, export: saved };
    };

    core.version = VERSION;
    core.add?.("auditor-beta21-patch-ready", "info", {
      version: VERSION,
      deepScan: true,
      uniqueCounting: true,
      preciseRouteTiming: true,
      blackBox: Boolean(window.SantaLuziaBlackBox),
      applicationExitInfo: true,
      perfettoTraceMarkers: true,
      crashlyticsAdapter: true,
    });
    window.dispatchEvent(new CustomEvent("santa-luzia:diagnostico-updated", { detail: { type: "auditor-beta21-patch-ready" } }));
  }

  patch();
})();
