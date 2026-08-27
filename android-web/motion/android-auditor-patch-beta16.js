"use strict";

(() => {
  const VERSION = "2.0.0-beta.16";
  const FLAG = "santaLuziaAuditorBeta16Patched";

  function compactEvents(events) {
    const list = Array.isArray(events) ? events : [];
    const out = [];
    let lastDb = null;
    let lastIconOk = null;
    for (const event of list) {
      if (event?.type === "local-db-health" && event?.level === "info") { lastDb = event; continue; }
      if (event?.type === "icon-audit" && event?.level === "info") { lastIconOk = event; continue; }
      out.push(event);
    }
    if (lastDb) out.push(lastDb);
    if (lastIconOk) out.push(lastIconOk);
    return out.slice(-700);
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

    const originalSnapshot = core.snapshot.bind(core);
    core.snapshot = async function beta16Snapshot() {
      const report = await originalSnapshot();
      const deepResult = deep.getLast?.() || null;
      const events = compactEvents(report.events);
      const summary = {
        ...report.summary,
        errors: events.filter((event) => event?.level === "error").length,
        warnings: events.filter((event) => event?.level === "warning").length,
        deepFindings: Number(deepResult?.summary?.findings || 0),
        deepErrors: Number(deepResult?.summary?.errors || 0),
        deepWarnings: Number(deepResult?.summary?.warnings || 0),
      };
      return {
        ...report,
        schema: "santa-luzia-diagnostico-v3",
        app: { ...(report.app || {}), version: VERSION },
        summary,
        events,
        deepAudit: deepResult,
        glitchTip: deep.getGlitchTipStatus?.() || null,
        privacy: "Relatório técnico sem cookies, senhas, tokens, corpos de requisição ou conteúdo pessoal deliberadamente coletado. Deep Scan usa somente geometria, seletores técnicos e estado de componentes.",
      };
    };

    core.exportReport = async function beta16ExportReport() {
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
      core.add?.("report-exported", "info", { events: report.events.length, fileName, method: saved.method, beta16: true, deepFindings: report.summary.deepFindings });
      return { ...report, export: saved };
    };

    core.version = VERSION;
    core.add?.("auditor-beta16-patch-ready", "info", { version: VERSION, deepScan: true, glitchTipBridge: true });
    window.dispatchEvent(new CustomEvent("santa-luzia:diagnostico-updated", { detail: { type: "auditor-beta16-patch-ready" } }));
  }

  patch();
})();
