"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const FLAG = "santaLuziaVisualForensicsBeta21";
  const STORAGE_KEY = "santa-luzia:visual-forensics:v1";
  const SAMPLE_MS = 250;
  const PREBUFFER_MS = 6000;
  const POSTBUFFER_MS = 6000;
  const MAX_PRE_FRAMES = Math.ceil(PREBUFFER_MS / SAMPLE_MS) + 4;
  const MAX_INCIDENTS = 10;
  const MAX_FRAMES_PER_INCIDENT = 56;
  const TRIGGERS = new Set([
    "layout-shift-burst",
    "unexpected-scroll-burst",
    "document-growth-burst",
    "resize-loop-burst",
    "visual-blank-frame",
    "javascript-error",
    "unhandled-rejection",
    "previous-fatal-exception",
  ]);

  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let prebuffer = [];
  let incidents = [];
  let active = [];
  let mutationCount = 0;
  let mutationTargets = [];

  function clamp(value, max = 140) {
    const text = String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function route() {
    return `${location.pathname}${location.search}${location.hash}`;
  }

  function rectOf(element) {
    if (!(element instanceof Element)) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      id: clamp(element.id, 70),
      className: clamp(element.className, 160),
      role: clamp(element.getAttribute("role"), 50),
      dataState: clamp(element.getAttribute("data-state"), 50),
      dataAction: clamp(element.getAttribute("data-action") || element.getAttribute("data-sl-nav-motion"), 80),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity || "1"),
      position: style.position,
      overflowY: style.overflowY,
    };
  }

  function targetMeta(element) {
    if (!(element instanceof Element)) return null;
    return {
      tag: element.tagName.toLowerCase(),
      id: clamp(element.id, 70),
      className: clamp(element.className, 160),
      role: clamp(element.getAttribute("role"), 50),
      dataState: clamp(element.getAttribute("data-state"), 50),
      dataAction: clamp(element.getAttribute("data-action") || element.getAttribute("data-sl-nav-motion"), 80),
      inHeader: Boolean(element.closest("header")),
      inNavigation: Boolean(element.closest("nav,[role='navigation']")),
      inDialog: Boolean(element.closest("[role='dialog'],[aria-modal='true']")),
    };
  }

  function keyRegions() {
    const selectors = [
      "header",
      "nav",
      "main",
      "footer",
      "aside",
      "[role='navigation']",
      "[role='dialog']",
      "[aria-modal='true']",
      "[data-state='open']",
      "#root",
    ];
    const seen = new Set();
    const result = [];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        const meta = rectOf(element);
        if (!meta) continue;
        if (result.length < 10) result.push(meta);
      }
      if (result.length >= 10) break;
    }
    return result;
  }

  function frame() {
    const root = document.documentElement;
    const body = document.body;
    const scrollY = Math.round(window.scrollY || root.scrollTop || body?.scrollTop || 0);
    const scrollHeight = Math.max(root.scrollHeight || 0, body?.scrollHeight || 0);
    const viewportHeight = Math.round(window.innerHeight || root.clientHeight || 0);
    const focus = document.activeElement instanceof Element ? targetMeta(document.activeElement) : null;
    const currentMutations = mutationCount;
    const currentTargets = mutationTargets.slice(-6);
    mutationCount = 0;
    mutationTargets = [];
    return {
      at: Date.now(),
      perfAt: Math.round(performance.now()),
      route: route(),
      visibility: document.visibilityState,
      scrollY,
      scrollHeight,
      viewportHeight,
      viewportWidth: Math.round(window.innerWidth || root.clientWidth || 0),
      bodyHeight: body ? Math.round(body.getBoundingClientRect().height) : 0,
      rootHeight: Math.round(root.getBoundingClientRect().height),
      focus,
      mutationCount: currentMutations,
      mutationTargets: currentTargets,
      regions: keyRegions(),
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: VERSION,
        runId,
        updatedAt: Date.now(),
        incidents: incidents.slice(-MAX_INCIDENTS),
      }));
    } catch {}
  }

  function readPrevious() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Array.isArray(parsed?.incidents) ? parsed.incidents.slice(-MAX_INCIDENTS) : [];
    } catch { return []; }
  }

  const historicalIncidents = readPrevious().filter((incident) => incident?.runId && incident.runId !== runId);

  function addFrameToIncident(incident, item) {
    incident.frames.push(item);
    if (incident.frames.length > MAX_FRAMES_PER_INCIDENT) incident.frames = incident.frames.slice(-MAX_FRAMES_PER_INCIDENT);
  }

  function startIncident(triggerType, detail = {}) {
    const now = Date.now();
    const same = active.find((item) => item.route === route() && now - item.lastTriggerAt < 1800);
    if (same) {
      same.lastTriggerAt = now;
      same.captureUntil = Math.max(same.captureUntil, now + POSTBUFFER_MS);
      same.triggers.push({ at: now, type: triggerType, detail });
      return same;
    }
    const incident = {
      id: `${runId}-incident-${now}-${Math.random().toString(36).slice(2, 6)}`,
      runId,
      route: route(),
      startedAt: now,
      lastTriggerAt: now,
      captureUntil: now + POSTBUFFER_MS,
      triggers: [{ at: now, type: triggerType, detail }],
      frames: prebuffer.filter((item) => now - item.at <= PREBUFFER_MS),
      complete: false,
    };
    active.push(incident);
    try {
      window.SantaLuziaBlackBox?.record?.("visual-forensics-trigger", "info", {
        triggerType,
        incidentId: incident.id,
        preFrames: incident.frames.length,
      }, "Gravador forense visual iniciou captura de incidente.");
    } catch {}
    return incident;
  }

  function finishIncident(incident) {
    incident.complete = true;
    incident.finishedAt = Date.now();
    incident.durationMs = Math.max(0, incident.finishedAt - incident.startedAt);
    delete incident.captureUntil;
    incidents.push(incident);
    incidents = incidents.slice(-MAX_INCIDENTS);
    active = active.filter((item) => item !== incident);
    persist();
    try {
      window.SantaLuziaBlackBox?.record?.("visual-forensics-saved", "info", {
        incidentId: incident.id,
        triggers: incident.triggers.map((item) => item.type).slice(0, 12),
        frames: incident.frames.length,
        durationMs: incident.durationMs,
      }, "Incidente visual preservado para auditoria.");
    } catch {}
  }

  function sample() {
    if (document.visibilityState !== "visible") return;
    const item = frame();
    prebuffer.push(item);
    if (prebuffer.length > MAX_PRE_FRAMES) prebuffer = prebuffer.slice(-MAX_PRE_FRAMES);
    for (const incident of [...active]) {
      addFrameToIncident(incident, item);
      if (Date.now() >= incident.captureUntil) finishIncident(incident);
    }
  }

  const mutations = new MutationObserver((records) => {
    mutationCount += records.length;
    for (const record of records.slice(0, 8)) {
      const target = record.target instanceof Element ? record.target : record.target?.parentElement;
      const meta = targetMeta(target);
      if (meta && mutationTargets.length < 12) mutationTargets.push(meta);
    }
  });

  function installMutationObserver() {
    const root = document.getElementById("root") || document.body || document.documentElement;
    if (!root) return;
    try { mutations.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "data-state", "aria-hidden"] }); } catch {}
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button,[role='button'],a[href]") : null;
    if (!target) return;
    const meta = targetMeta(target);
    const navControl = Boolean(meta?.inHeader || meta?.inNavigation || /menu|nav|drawer|sidebar|hamburger/i.test(`${meta?.className || ""} ${meta?.dataAction || ""}`));
    if (navControl) startIncident("navigation-control-click", { target: meta });
  }, true);

  window.addEventListener("santa-luzia:blackbox-event", (event) => {
    const type = String(event?.detail?.type || "");
    if (TRIGGERS.has(type)) startIncident(type, { level: String(event?.detail?.level || "") });
  });

  window.addEventListener("santa-luzia:route-start", (event) => {
    startIncident("route-transition", { target: clamp(event?.detail?.target, 180) });
  });

  const timer = window.setInterval(sample, SAMPLE_MS);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installMutationObserver, { once: true });
  else installMutationObserver();
  window.setTimeout(sample, 40);

  function snapshot() {
    for (const incident of active) {
      if (!incident.frames.length) incident.frames = prebuffer.slice(-MAX_PRE_FRAMES);
    }
    return {
      version: VERSION,
      runId,
      generatedAt: new Date().toISOString(),
      mode: "privacy-preserving-visual-timeline",
      currentRunIncidents: incidents.filter((item) => item.runId === runId),
      activeIncidents: active.map((item) => ({ ...item, frames: item.frames.slice(-MAX_FRAMES_PER_INCIDENT) })),
      historicalIncidentCount: historicalIncidents.length,
      prebufferFrames: prebuffer.length,
      samplingMs: SAMPLE_MS,
      prebufferMs: PREBUFFER_MS,
      postbufferMs: POSTBUFFER_MS,
      privacy: "Não grava pixels, textos, campos, senhas ou conteúdo pessoal. Cada quadro contém apenas geometria, visibilidade, estrutura DOM e metadados técnicos de componentes.",
    };
  }

  function clear() {
    incidents = [];
    active = [];
    prebuffer = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  window.SantaLuziaVisualForensics = { version: VERSION, snapshot, clear, startIncident, captureNow: sample };

  window.addEventListener("pagehide", () => {
    for (const incident of [...active]) finishIncident(incident);
    clearInterval(timer);
    try { mutations.disconnect(); } catch {}
  });
})();
