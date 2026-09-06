"use strict";

const fs = require("node:fs");
const path = require("node:path");

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") {
  console.log("[beta21-visual-forensics] fora do canal Motion Beta; nada a fazer.");
  process.exit(0);
}

const file = path.join(process.cwd(), "android-web", "motion", "android-visual-forensics-beta21.js");
let source = fs.readFileSync(file, "utf8");

const before = `  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    counters.visibilityChanges += 1;
    if (document.visibilityState === "visible") {
      if (hiddenStartedAt) counters.hiddenMs += Math.max(0, now - hiddenStartedAt);
      hiddenStartedAt = 0;
      visibleStartedAt = now;
      appendTimeline("visibility", { state: "visible" });
      sample("visible");
    } else {
      if (visibleStartedAt) counters.visibleMs += Math.max(0, now - visibleStartedAt);
      visibleStartedAt = 0;
      hiddenStartedAt = now;
      appendTimeline("visibility", { state: document.visibilityState });
      persistNow();
    }
  });`;

const after = `  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    counters.visibilityChanges += 1;
    if (document.visibilityState === "visible") {
      if (hiddenStartedAt) counters.hiddenMs += Math.max(0, now - hiddenStartedAt);
      hiddenStartedAt = 0;
      visibleStartedAt = now;
      previousFrame = null;
      prebuffer = [];
      appendTimeline("visibility", { state: "visible", baselineReset: true });
      sample("visible");
    } else {
      if (visibleStartedAt) counters.visibleMs += Math.max(0, now - visibleStartedAt);
      visibleStartedAt = 0;
      hiddenStartedAt = now;
      appendTimeline("visibility", { state: document.visibilityState, closedActiveIncidents: active.length });
      for (const incident of [...active]) {
        incident.finishReason = "visibility-hidden";
        finishIncident(incident);
      }
      previousFrame = null;
      prebuffer = [];
      persistNow();
    }
  });`;

if (!source.includes(before)) {
  if (source.includes('incident.finishReason = "visibility-hidden"')) {
    console.log("[beta21-visual-forensics] patch de ciclo de vida já aplicado.");
    process.exit(0);
  }
  throw new Error("Bloco visibilitychange esperado não encontrado; patch não aplicado para evitar alteração insegura.");
}

source = source.replace(before, after);

if (!source.includes('incident.finishReason = "visibility-hidden"')) {
  throw new Error("Validação falhou: encerramento de incidente ao ocultar não foi instalado.");
}
if (!source.includes('baselineReset: true')) {
  throw new Error("Validação falhou: reset de baseline ao retomar não foi instalado.");
}

fs.writeFileSync(file, source);
console.log("[beta21-visual-forensics] ciclo de vida corrigido: incidentes fecham ao ocultar e baseline reinicia ao retomar.");
