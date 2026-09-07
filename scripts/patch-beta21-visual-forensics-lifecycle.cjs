"use strict";

const fs = require("node:fs");
const path = require("node:path");

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") {
  console.log("[beta21-visual-forensics] fora do canal Motion Beta; nada a fazer.");
  process.exit(0);
}

const root = process.cwd();
const file = path.join(root, "android-web", "motion", "android-visual-forensics-beta21.js");
const indexFile = path.join(root, "android-web", "index.html");
const deepAuditorFile = path.join(root, "android-web", "motion", "android-deep-auditor-beta16.js");
const auditorPatchFile = path.join(root, "android-web", "motion", "android-auditor-patch-beta16.js");
let source = fs.readFileSync(file, "utf8");

// O diagnóstico continua ativo, porém fora do caminho crítico de desenho do WebView.
// A amostragem e a persistência foram espaçadas para reduzir contenção com React,
// navegação e IndexedDB sem perder a capacidade de registrar incidentes visuais.
source = source
  .replace('const SAMPLE_MS = 250;', 'const SAMPLE_MS = 1200;')
  .replace('const MAX_TIMELINE = 4096;', 'const MAX_TIMELINE = 1024;')
  .replace('persistTimer = window.setTimeout(persistNow, 2200);', 'persistTimer = window.setTimeout(persistNow, 8000);');

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

if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
} else if (!source.includes('incident.finishReason = "visibility-hidden"')) {
  throw new Error("Bloco visibilitychange esperado não encontrado; patch não aplicado para evitar alteração insegura.");
} else {
  fs.writeFileSync(file, source);
}

source = fs.readFileSync(file, "utf8");
if (!source.includes('incident.finishReason = "visibility-hidden"')) {
  throw new Error("Validação falhou: encerramento de incidente ao ocultar não foi instalado.");
}
if (!source.includes('baselineReset: true')) {
  throw new Error("Validação falhou: reset de baseline ao retomar não foi instalado.");
}
if (!source.includes('const SAMPLE_MS = 1200;')) {
  throw new Error("Validação falhou: frequência reduzida do Sentinela Visual não foi instalada.");
}
if (!source.includes('const MAX_TIMELINE = 1024;')) {
  throw new Error("Validação falhou: limite de timeline otimizado não foi instalado.");
}
if (!source.includes('persistTimer = window.setTimeout(persistNow, 8000);')) {
  throw new Error("Validação falhou: persistência desacelerada do Sentinela Visual não foi instalada.");
}

for (const required of [deepAuditorFile, auditorPatchFile]) {
  if (!fs.existsSync(required) || fs.statSync(required).size < 5000) {
    throw new Error(`Camada obrigatória do Auditor ausente ou truncada: ${path.basename(required)}`);
  }
}

let html = fs.readFileSync(indexFile, "utf8");
const baseAuditorTag = '    <script defer src="/motion/android-auditor-beta12.js"></script>';
const deepTag = '    <script defer src="/motion/android-deep-auditor-beta16.js"></script>';
const patchTag = '    <script defer src="/motion/android-auditor-patch-beta16.js"></script>';
if (!html.includes(baseAuditorTag)) {
  throw new Error("Auditor base não encontrado no index Android para inserir as camadas profundas.");
}
html = html.replace(deepTag, "").replace(patchTag, "");
html = html.replace(baseAuditorTag, `${baseAuditorTag}\n${deepTag}\n${patchTag}`);
fs.writeFileSync(indexFile, html);

if (!(html.indexOf(baseAuditorTag) < html.indexOf(deepTag) && html.indexOf(deepTag) < html.indexOf(patchTag))) {
  throw new Error("Ordem das camadas do Auditor profundo ficou inválida.");
}

console.log("[beta21-visual-forensics] Sentinela mantido com amostragem a 1200 ms e persistência a 8000 ms; diagnóstico profundo preservado.");
