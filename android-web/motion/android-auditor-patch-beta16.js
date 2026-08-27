"use strict";

(() => {
  const VERSION = "2.0.0-beta.17";
  const FLAG = "santaLuziaAuditorBeta17Patched";
  const STORAGE_KEY = "santa-luzia:auditor:v1";
  const CLEAN_VERSION_KEY = "santa-luzia:auditor:last-clean-version";

  function eventSignature(event) {
    const type = String(event?.type || "unknown");
    const route = String(event?.route || "");
    if (type === "javascript-error") return `${type}|${event?.message || ""}|${event?.file || ""}|${event?.line || ""}`;
    if (type === "unhandled-rejection") return `${type}|${event?.name || ""}|${event?.message || ""}`;
    if (type === "fetch" || type === "fetch-error") return `${type}|${event?.method || "GET"}|${event?.path || ""}|${event?.status || 0}|${route}`;
    if (type === "fps-sample") return `${type}|${route}|${Number(event?.fps || 0) < 45 ? "low" : "ok"}`;
    if (type === "scroll-jump" || type === "missing-icons" || type === "icon-audit") return `${type}|${route}`;
    if (type === "local-db-health") return `${type}|${event?.ok === false ? "bad" : "ok"}`;
    if (type === "route-transition") return `${type}|${event?.pathname || route}`;
    return `${type}|${event?.level || "info"}|${route}`;
  }

  function isExpectedNoise(event) {
    if (!event) return true;
    const type = String(event.type || "");
    const path = String(event.path || "");
    const route = String(event.route || "");
    const status = Number(event.status || 0);

    // Eventos gravados por versões anteriores não pertencem ao diagnóstico atual.
    if ((type === "auditor-ready" || type === "scroll-stability") && event.version && event.version !== VERSION) return true;

    // Antes de existir sessão, endpoints privados podem responder 401. Isso é fluxo
    // normal de autenticação e não deve virar "erro do aplicativo".
    if (type === "fetch" && status === 401 && (route === "/" || route.startsWith("/area-restrita/login"))) return true;

    // A ponte GlitchTip é opcional. Servidor ainda sem DSN/rota não é falha do APK.
    if (type === "fetch" && status === 404 && path === "/api/configuracao/diagnostico") return true;

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
      // Mantemos os dados mais recentes, mas não criamos um novo erro.
      for (const [key, value] of Object.entries(event)) if (value !== undefined) current[key] = value;
      current.signature = signature;
    }

    return [...bySignature.values()]
      .sort((a, b) => Number(a.lastAt || a.at || 0) - Number(b.lastAt || b.at || 0))
      .slice(-260);
  }

  function persistCompacted(events) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), events }));
    } catch {}
  }

  function uniqueSummary(events, original, deepResult) {
    const errors = events.filter((event) => event?.level === "error").length;
    const warnings = events.filter((event) => event?.level === "warning").length;
    return {
      ...original,
      errors,
      warnings,
      slowRequests: events.filter((event) => event?.type === "fetch" && event?.slow).length,
      lowFpsSamples: events.filter((event) => event?.type === "fps-sample" && Number(event?.fps || 60) < 45).length,
      scrollJumps: events.filter((event) => event?.type === "scroll-jump").length,
      missingIconAudits: events.filter((event) => event?.type === "missing-icons").length,
      deepFindings: Number(deepResult?.summary?.findings || 0),
      deepErrors: Number(deepResult?.summary?.errors || 0),
      deepWarnings: Number(deepResult?.summary?.warnings || 0),
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

  function patch() {
    const core = window.SantaLuziaAuditor;
    const deep = window.SantaLuziaDeepAudit;
    if (!core || !deep) { setTimeout(patch, 120); return; }
    if (core[FLAG]) return;
    core[FLAG] = true;

    // O primeiro carregamento da Beta 17 descarta automaticamente o histórico da
    // Beta 16. Atualizar a tela depois disso NÃO limpa nem incrementa artificialmente.
    try {
      if (localStorage.getItem(CLEAN_VERSION_KEY) !== VERSION) {
        core.clear();
        localStorage.setItem(CLEAN_VERSION_KEY, VERSION);
        localStorage.removeItem("santa-luzia:deep-audit:last:v1");
      }
    } catch {}

    const originalSnapshot = core.snapshot.bind(core);
    core.snapshot = async function beta17Snapshot() {
      const report = await originalSnapshot();
      const deepResult = deep.getLast?.() || null;
      const events = compactEvents(report.events);
      persistCompacted(events);
      const summary = uniqueSummary(events, report.summary || {}, deepResult);
      return {
        ...report,
        schema: "santa-luzia-diagnostico-v4",
        app: { ...(report.app || {}), version: VERSION },
        summary,
        events,
        deepAudit: deepResult,
        glitchTip: deep.getGlitchTipStatus?.() || null,
        counting: {
          mode: "unique-signatures",
          note: "Repetições do mesmo defeito incrementam occurrences e não aumentam o total de erros/alertas.",
        },
        privacy: "Relatório técnico sem cookies, senhas, tokens, corpos de requisição ou conteúdo pessoal deliberadamente coletado. Deep Scan usa somente geometria, seletores técnicos e estado de componentes.",
      };
    };

    core.exportReport = async function beta17ExportReport() {
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
      core.add?.("report-exported", "info", { events: report.events.length, fileName, method: saved.method, beta17: true, uniqueErrors: report.summary.errors });
      return { ...report, export: saved };
    };

    core.version = VERSION;
    core.add?.("auditor-beta17-patch-ready", "info", { version: VERSION, deepScan: true, uniqueCounting: true });
    window.dispatchEvent(new CustomEvent("santa-luzia:diagnostico-updated", { detail: { type: "auditor-beta17-patch-ready" } }));
  }

  patch();
})();
