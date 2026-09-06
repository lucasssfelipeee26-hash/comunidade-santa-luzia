"use strict";

(() => {
  const VERSION = "2.0.0-beta.21";
  const ENGINE = "always-on-visual-sentinel-v2";
  const FLAG = "santaLuziaVisualForensicsBeta21";
  const STORAGE_KEY = "santa-luzia:visual-forensics:v1";
  const SAMPLE_MS = 250;
  const PREBUFFER_MS = 8000;
  const POSTBUFFER_MS = 8000;
  const HEARTBEAT_MS = 60000;
  const TIMELINE_WINDOW_MS = 24 * 60 * 60 * 1000;
  const MAX_PRE_FRAMES = Math.ceil(PREBUFFER_MS / SAMPLE_MS) + 6;
  const MAX_INCIDENTS = 16;
  const MAX_FRAMES_PER_INCIDENT = 72;
  const MAX_TIMELINE = 4096;
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

  if (document.documentElement.dataset[FLAG] === ENGINE) return;
  document.documentElement.dataset[FLAG] = ENGINE;

  const startedAt = Date.now();
  const runId = `${startedAt}-${Math.random().toString(36).slice(2, 9)}`;
  let blackBoxRunId = "";
  let prebuffer = [];
  let incidents = [];
  let active = [];
  let timeline = [];
  let mutationCount = 0;
  let mutationTargets = [];
  let previousFrame = null;
  let persistTimer = 0;
  let visibleStartedAt = document.visibilityState === "visible" ? startedAt : 0;
  let hiddenStartedAt = document.visibilityState !== "visible" ? startedAt : 0;

  const counters = {
    samples: 0,
    stateChanges: 0,
    interactions: 0,
    navigationInteractions: 0,
    routeTransitions: 0,
    mutationRecords: 0,
    visibilityChanges: 0,
    viewportChanges: 0,
    timelineDropped: 0,
    persistenceFailures: 0,
    visibleMs: 0,
    hiddenMs: 0,
  };

  function clamp(value, max = 160) {
    const text = String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function route() {
    return `${location.pathname}${location.search}${location.hash}`;
  }

  function classNameOf(element) {
    if (!(element instanceof Element)) return "";
    const value = typeof element.className === "string" ? element.className : element.getAttribute("class") || "";
    return clamp(value, 180);
  }

  function targetMeta(element) {
    if (!(element instanceof Element)) return null;
    const ancestry = [];
    let cursor = element;
    for (let depth = 0; cursor && depth < 4; depth += 1, cursor = cursor.parentElement) {
      ancestry.push({
        tag: cursor.tagName.toLowerCase(),
        id: clamp(cursor.id, 60),
        className: classNameOf(cursor),
        role: clamp(cursor.getAttribute("role"), 50),
        dataAction: clamp(cursor.getAttribute("data-action") || cursor.getAttribute("data-sl-nav-motion"), 80),
      });
    }
    return {
      tag: element.tagName.toLowerCase(),
      id: clamp(element.id, 70),
      className: classNameOf(element),
      role: clamp(element.getAttribute("role"), 50),
      dataState: clamp(element.getAttribute("data-state"), 50),
      dataAction: clamp(element.getAttribute("data-action") || element.getAttribute("data-sl-nav-motion"), 80),
      inHeader: Boolean(element.closest("header")),
      inNavigation: Boolean(element.closest("nav,[role='navigation'],.app-nav-panel,.mobile-app-bottom-nav,.app-mobile-menu-layer")),
      inDialog: Boolean(element.closest("[role='dialog'],[aria-modal='true']")),
      ancestry,
    };
  }

  function regionKey(meta) {
    if (!meta) return "";
    return `${meta.tag}|${meta.id}|${meta.className}|${meta.role}|${meta.dataAction}`;
  }

  function rectOf(element) {
    if (!(element instanceof Element)) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      id: clamp(element.id, 70),
      className: classNameOf(element),
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
      zIndex: clamp(style.zIndex, 30),
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      transform: clamp(style.transform, 120),
      transitionDuration: clamp(style.transitionDuration, 80),
      animationName: clamp(style.animationName, 100),
      animationDuration: clamp(style.animationDuration, 80),
    };
  }

  function keyRegions() {
    const selectors = [
      ".app-nav-panel",
      ".mobile-app-bottom-nav",
      ".app-mobile-menu-layer",
      "header",
      "nav",
      "main",
      "main > section",
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
        result.push(meta);
        if (result.length >= 14) return result;
      }
    }
    return result;
  }

  function activeAnimations() {
    if (typeof document.getAnimations !== "function") return [];
    try {
      return document.getAnimations().slice(0, 12).map((animation) => {
        const target = animation.effect?.target instanceof Element ? animation.effect.target : null;
        const style = target ? getComputedStyle(target) : null;
        return {
          target: targetMeta(target),
          playState: clamp(animation.playState, 30),
          currentTime: Number.isFinite(Number(animation.currentTime)) ? Math.round(Number(animation.currentTime)) : null,
          animationName: clamp(style?.animationName, 100),
          transitionProperty: clamp(style?.transitionProperty, 100),
          opacity: style ? Number.parseFloat(style.opacity || "1") : null,
          transform: clamp(style?.transform, 120),
        };
      });
    } catch { return []; }
  }

  function frame() {
    const root = document.documentElement;
    const body = document.body;
    const scrollY = Math.round(window.scrollY || root.scrollTop || body?.scrollTop || 0);
    const scrollHeight = Math.max(root.scrollHeight || 0, body?.scrollHeight || 0);
    const viewportHeight = Math.round(window.innerHeight || root.clientHeight || 0);
    const focus = document.activeElement instanceof Element ? targetMeta(document.activeElement) : null;
    const currentMutations = mutationCount;
    const currentTargets = mutationTargets.slice(-8);
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
      animations: activeAnimations(),
    };
  }

  function compareRegions(previous, current) {
    const before = new Map((previous || []).map((item) => [regionKey(item), item]));
    const after = new Map((current || []).map((item) => [regionKey(item), item]));
    const changes = [];
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const key of keys) {
      const a = before.get(key);
      const b = after.get(key);
      if (!a || !b) {
        changes.push({ key: clamp(key, 220), kind: a ? "removed" : "added", before: a || null, after: b || null });
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dw = b.width - a.width;
      const dh = b.height - a.height;
      const opacityDelta = Number(((b.opacity || 0) - (a.opacity || 0)).toFixed(3));
      const styleChanged = a.display !== b.display || a.visibility !== b.visibility || a.transform !== b.transform || a.position !== b.position || a.animationName !== b.animationName;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(dw) < 2 && Math.abs(dh) < 2 && Math.abs(opacityDelta) < 0.04 && !styleChanged) continue;
      changes.push({
        key: clamp(key, 220),
        kind: "changed",
        delta: { x: dx, y: dy, width: dw, height: dh, opacity: opacityDelta },
        before: { x: a.x, y: a.y, width: a.width, height: a.height, opacity: a.opacity, display: a.display, visibility: a.visibility, transform: a.transform, animationName: a.animationName },
        after: { x: b.x, y: b.y, width: b.width, height: b.height, opacity: b.opacity, display: b.display, visibility: b.visibility, transform: b.transform, animationName: b.animationName },
      });
      if (changes.length >= 14) break;
    }
    return changes;
  }

  function diffFrames(previous, current) {
    if (!previous) return { significant: true, firstFrame: true, regionChanges: [] };
    const regionChanges = compareRegions(previous.regions, current.regions);
    const routeChanged = previous.route !== current.route;
    const scrollDelta = current.scrollY - previous.scrollY;
    const documentHeightDelta = current.scrollHeight - previous.scrollHeight;
    const bodyHeightDelta = current.bodyHeight - previous.bodyHeight;
    const rootHeightDelta = current.rootHeight - previous.rootHeight;
    const viewportWidthDelta = current.viewportWidth - previous.viewportWidth;
    const viewportHeightDelta = current.viewportHeight - previous.viewportHeight;
    const animationChanged = JSON.stringify(previous.animations || []) !== JSON.stringify(current.animations || []);
    const significant = routeChanged || Math.abs(scrollDelta) >= 20 || Math.abs(documentHeightDelta) >= 8 || Math.abs(bodyHeightDelta) >= 8 || Math.abs(rootHeightDelta) >= 8 || viewportWidthDelta !== 0 || viewportHeightDelta !== 0 || regionChanges.length > 0 || current.mutationCount > 0 || animationChanged;
    return {
      significant,
      routeChanged,
      scrollDelta,
      documentHeightDelta,
      bodyHeightDelta,
      rootHeightDelta,
      viewportWidthDelta,
      viewportHeightDelta,
      mutationCount: current.mutationCount,
      animationChanged,
      regionChanges,
    };
  }

  function compactFrame(item, diff = null) {
    return {
      at: item.at,
      perfAt: item.perfAt,
      route: item.route,
      visibility: item.visibility,
      scrollY: item.scrollY,
      scrollHeight: item.scrollHeight,
      viewportHeight: item.viewportHeight,
      viewportWidth: item.viewportWidth,
      bodyHeight: item.bodyHeight,
      rootHeight: item.rootHeight,
      mutationCount: item.mutationCount,
      mutationTargets: item.mutationTargets,
      animations: item.animations,
      regionChanges: diff?.regionChanges || [],
      deltas: diff ? {
        scrollY: diff.scrollDelta || 0,
        documentHeight: diff.documentHeightDelta || 0,
        bodyHeight: diff.bodyHeightDelta || 0,
        rootHeight: diff.rootHeightDelta || 0,
        viewportWidth: diff.viewportWidthDelta || 0,
        viewportHeight: diff.viewportHeightDelta || 0,
      } : null,
    };
  }

  function pruneTimeline(now = Date.now()) {
    const before = timeline.length;
    timeline = timeline.filter((item) => now - Number(item.at || now) <= TIMELINE_WINDOW_MS);
    if (timeline.length > MAX_TIMELINE) timeline = timeline.slice(-MAX_TIMELINE);
    if (before > timeline.length) counters.timelineDropped += before - timeline.length;
  }

  function appendTimeline(type, detail = {}, options = {}) {
    const now = Date.now();
    const entry = {
      at: now,
      perfAt: Math.round(performance.now()),
      type,
      route: route(),
      detail,
    };
    const previous = timeline[timeline.length - 1];
    if (options.coalesce && previous?.type === type && previous.route === entry.route && now - Number(previous.at || 0) <= Number(options.windowMs || 750)) {
      previous.lastAt = now;
      previous.count = Number(previous.count || 1) + 1;
      previous.detail = detail;
    } else {
      timeline.push(entry);
    }
    pruneTimeline(now);
    schedulePersist();
    return entry;
  }

  function readPrevious() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch { return null; }
  }

  const previousStored = readPrevious();
  const historicalIncidents = Array.isArray(previousStored?.incidents)
    ? previousStored.incidents.filter((incident) => incident?.runId && incident.runId !== runId).slice(-MAX_INCIDENTS)
    : [];

  function payload() {
    return {
      version: VERSION,
      engine: ENGINE,
      runId,
      blackBoxRunId,
      startedAt,
      updatedAt: Date.now(),
      counters,
      timeline: timeline.slice(-MAX_TIMELINE),
      incidents: incidents.slice(-MAX_INCIDENTS),
    };
  }

  function persistNow() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = 0;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    } catch {
      counters.persistenceFailures += 1;
      try {
        timeline = timeline.slice(-Math.min(1800, timeline.length));
        incidents = incidents.slice(-Math.min(10, incidents.length));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
      } catch {}
    }
  }

  function schedulePersist() {
    if (persistTimer) return;
    persistTimer = window.setTimeout(persistNow, 2200);
  }

  function addFrameToIncident(incident, item) {
    incident.frames.push(item);
    if (incident.frames.length > MAX_FRAMES_PER_INCIDENT) incident.frames = incident.frames.slice(-MAX_FRAMES_PER_INCIDENT);
  }

  function startIncident(triggerType, detail = {}) {
    const now = Date.now();
    const currentRoute = route();
    const same = active.find((item) => item.route === currentRoute && now - item.lastTriggerAt < 2400);
    if (same) {
      same.lastTriggerAt = now;
      same.captureUntil = Math.max(same.captureUntil, now + POSTBUFFER_MS);
      same.triggers.push({ at: now, type: triggerType, detail });
      return same;
    }
    const incident = {
      id: `${runId}-incident-${now}-${Math.random().toString(36).slice(2, 6)}`,
      runId,
      blackBoxRunId,
      route: currentRoute,
      startedAt: now,
      lastTriggerAt: now,
      captureUntil: now + POSTBUFFER_MS,
      triggers: [{ at: now, type: triggerType, detail }],
      frames: prebuffer.filter((item) => now - item.at <= PREBUFFER_MS),
      complete: false,
    };
    active.push(incident);
    appendTimeline("incident-start", { triggerType, incidentId: incident.id, preFrames: incident.frames.length });
    try {
      window.SantaLuziaBlackBox?.record?.("visual-forensics-trigger", "info", {
        triggerType,
        incidentId: incident.id,
        preFrames: incident.frames.length,
        engine: ENGINE,
      }, "Vigia forense visual iniciou captura de incidente.");
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
    appendTimeline("incident-saved", {
      incidentId: incident.id,
      triggers: incident.triggers.map((item) => item.type).slice(0, 16),
      frames: incident.frames.length,
      durationMs: incident.durationMs,
    });
    persistNow();
    try {
      window.SantaLuziaBlackBox?.record?.("visual-forensics-saved", "info", {
        incidentId: incident.id,
        triggers: incident.triggers.map((item) => item.type).slice(0, 16),
        frames: incident.frames.length,
        durationMs: incident.durationMs,
      }, "Incidente visual preservado para auditoria.");
    } catch {}
  }

  function sample(reason = "timer") {
    if (document.visibilityState !== "visible") return null;
    const item = frame();
    counters.samples += 1;
    const diff = diffFrames(previousFrame, item);
    prebuffer.push(item);
    if (prebuffer.length > MAX_PRE_FRAMES) prebuffer = prebuffer.slice(-MAX_PRE_FRAMES);

    if (diff.significant) {
      counters.stateChanges += 1;
      appendTimeline("visual-delta", { reason, frame: compactFrame(item, diff) }, { coalesce: reason === "timer", windowMs: 700 });
      const suspiciousGeometry = Math.abs(Number(diff.documentHeightDelta || 0)) >= 160 || Math.abs(Number(diff.bodyHeightDelta || 0)) >= 160 || Math.abs(Number(diff.rootHeightDelta || 0)) >= 160;
      const suspiciousRegion = diff.regionChanges.some((change) => {
        if (change.kind !== "changed") return false;
        const delta = change.delta || {};
        return Math.abs(Number(delta.y || 0)) >= 80 || Math.abs(Number(delta.height || 0)) >= 80 || Math.abs(Number(delta.opacity || 0)) >= 0.45;
      });
      if (suspiciousGeometry || suspiciousRegion) {
        startIncident("visual-state-change", {
          reason,
          documentHeightDelta: diff.documentHeightDelta || 0,
          bodyHeightDelta: diff.bodyHeightDelta || 0,
          rootHeightDelta: diff.rootHeightDelta || 0,
          regionChanges: diff.regionChanges.slice(0, 8),
        });
      }
    }

    for (const incident of [...active]) {
      addFrameToIncident(incident, item);
      if (Date.now() >= incident.captureUntil) finishIncident(incident);
    }
    previousFrame = item;
    return item;
  }

  const mutations = new MutationObserver((records) => {
    mutationCount += records.length;
    counters.mutationRecords += records.length;
    for (const record of records.slice(0, 12)) {
      const target = record.target instanceof Element ? record.target : record.target?.parentElement;
      const meta = targetMeta(target);
      if (meta && mutationTargets.length < 16) mutationTargets.push(meta);
    }
  });

  function installMutationObserver() {
    const root = document.getElementById("root") || document.body || document.documentElement;
    if (!root) return;
    try {
      mutations.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "data-state", "aria-hidden", "aria-expanded"],
      });
    } catch {}
  }

  function actionTarget(event) {
    return event.target instanceof Element
      ? event.target.closest("button,[role='button'],a[href],input[type='submit'],input[type='button'],select,[data-action],[data-sl-nav-motion]")
      : null;
  }

  document.addEventListener("click", (event) => {
    const target = actionTarget(event);
    if (!target) return;
    sample("interaction-before");
    const meta = targetMeta(target);
    const navControl = Boolean(meta?.inHeader || meta?.inNavigation || /menu|nav|drawer|sidebar|hamburger|bottom/i.test(`${meta?.className || ""} ${meta?.dataAction || ""}`));
    counters.interactions += 1;
    if (navControl) counters.navigationInteractions += 1;
    appendTimeline("interaction", { navigation: navControl, target: meta });
    startIncident(navControl ? "navigation-control-click" : "user-interaction", { target: meta });
    for (const delay of [60, 160, 360, 760, 1400]) window.setTimeout(() => sample(`interaction+${delay}ms`), delay);
  }, true);

  window.addEventListener("santa-luzia:blackbox-event", (event) => {
    const type = String(event?.detail?.type || "");
    if (TRIGGERS.has(type)) startIncident(type, { level: String(event?.detail?.level || "") });
  });

  window.addEventListener("santa-luzia:route-start", (event) => {
    counters.routeTransitions += 1;
    const target = clamp(event?.detail?.target, 180);
    appendTimeline("route-start", { target });
    startIncident("route-transition", { target });
    sample("route-start");
  });

  window.addEventListener("santa-luzia:route-settled", (event) => {
    const target = clamp(event?.detail?.target, 180);
    appendTimeline("route-settled", { target });
    sample("route-settled");
    for (const delay of [80, 220, 520, 1100, 2200]) window.setTimeout(() => sample(`route-settled+${delay}ms`), delay);
  });

  window.addEventListener("popstate", () => {
    appendTimeline("history-popstate", { route: route() });
    startIncident("history-popstate", { route: route() });
    sample("history-popstate");
  });

  window.addEventListener("hashchange", () => {
    appendTimeline("history-hashchange", { route: route() });
    sample("history-hashchange");
  });

  window.addEventListener("resize", () => {
    counters.viewportChanges += 1;
    appendTimeline("viewport-change", {
      width: Math.round(window.innerWidth || 0),
      height: Math.round(window.innerHeight || 0),
    }, { coalesce: true, windowMs: 900 });
    startIncident("viewport-change", { width: window.innerWidth, height: window.innerHeight });
    sample("resize");
  }, { passive: true });

  let scrollTimer = 0;
  window.addEventListener("scroll", () => {
    if (scrollTimer) return;
    scrollTimer = window.setTimeout(() => {
      scrollTimer = 0;
      const item = sample("scroll");
      if (item) appendTimeline("scroll-checkpoint", { scrollY: item.scrollY, scrollHeight: item.scrollHeight }, { coalesce: true, windowMs: 900 });
    }, 300);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
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
  });

  const timer = window.setInterval(() => sample("timer"), SAMPLE_MS);
  const heartbeat = window.setInterval(() => {
    const item = sample("heartbeat");
    appendTimeline("sentinel-heartbeat", {
      uptimeMs: Date.now() - startedAt,
      route: route(),
      visibility: document.visibilityState,
      samples: counters.samples,
      stateChanges: counters.stateChanges,
      scrollY: item?.scrollY ?? null,
      scrollHeight: item?.scrollHeight ?? null,
    });
    persistNow();
  }, HEARTBEAT_MS);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installMutationObserver, { once: true });
  else installMutationObserver();

  appendTimeline("watch-start", {
    engine: ENGINE,
    samplingMs: SAMPLE_MS,
    timelineWindowMs: TIMELINE_WINDOW_MS,
    mode: "privacy-preserving-visual-timeline",
  });
  const firstFrame = sample("app-start");
  startIncident("app-start", { route: route(), firstFrame: Boolean(firstFrame) });

  window.setTimeout(async () => {
    try {
      const box = await window.SantaLuziaBlackBox?.snapshot?.();
      blackBoxRunId = String(box?.runId || "");
      appendTimeline("blackbox-correlated", { blackBoxRunId });
    } catch {}
  }, 300);

  function liveDurations() {
    const now = Date.now();
    return {
      visibleMs: counters.visibleMs + (visibleStartedAt ? Math.max(0, now - visibleStartedAt) : 0),
      hiddenMs: counters.hiddenMs + (hiddenStartedAt ? Math.max(0, now - hiddenStartedAt) : 0),
    };
  }

  function snapshot() {
    const durations = liveDurations();
    for (const incident of active) {
      if (!incident.frames.length) incident.frames = prebuffer.slice(-MAX_PRE_FRAMES);
    }
    pruneTimeline();
    return {
      version: VERSION,
      engine: ENGINE,
      runId,
      blackBoxRunId,
      generatedAt: new Date().toISOString(),
      mode: "privacy-preserving-visual-timeline+continuous-sentinel",
      watch: {
        alwaysOnWhileAppRunning: true,
        startedAt,
        uptimeMs: Date.now() - startedAt,
        rollingWindowMs: TIMELINE_WINDOW_MS,
        samplingMs: SAMPLE_MS,
        heartbeatMs: HEARTBEAT_MS,
        prebufferMs: PREBUFFER_MS,
        postbufferMs: POSTBUFFER_MS,
        totalSamples: counters.samples,
        stateChanges: counters.stateChanges,
        interactions: counters.interactions,
        navigationInteractions: counters.navigationInteractions,
        routeTransitions: counters.routeTransitions,
        mutationRecords: counters.mutationRecords,
        visibilityChanges: counters.visibilityChanges,
        viewportChanges: counters.viewportChanges,
        timelineEntries: timeline.length,
        timelineDropped: counters.timelineDropped,
        persistenceFailures: counters.persistenceFailures,
        visibleMs: durations.visibleMs,
        hiddenMs: durations.hiddenMs,
      },
      continuousTimeline: timeline.slice(-MAX_TIMELINE),
      currentRunIncidents: incidents.filter((item) => item.runId === runId),
      activeIncidents: active.map((item) => ({ ...item, frames: item.frames.slice(-MAX_FRAMES_PER_INCIDENT) })),
      historicalIncidentCount: historicalIncidents.length,
      prebufferFrames: prebuffer.length,
      samplingMs: SAMPLE_MS,
      prebufferMs: PREBUFFER_MS,
      postbufferMs: POSTBUFFER_MS,
      privacy: "Vigia técnico contínuo: não grava vídeo, pixels, textos, campos, senhas ou conteúdo pessoal. Observa geometria, visibilidade, animações, estrutura DOM, interações, rotas, rolagem e metadados técnicos, com janela móvel de até 24 horas enquanto o aplicativo está em execução.",
    };
  }

  function clear() {
    incidents = [];
    active = [];
    prebuffer = [];
    timeline = [];
    previousFrame = null;
    counters.samples = 0;
    counters.stateChanges = 0;
    counters.interactions = 0;
    counters.navigationInteractions = 0;
    counters.routeTransitions = 0;
    counters.mutationRecords = 0;
    counters.visibilityChanges = 0;
    counters.viewportChanges = 0;
    counters.timelineDropped = 0;
    counters.persistenceFailures = 0;
    counters.visibleMs = 0;
    counters.hiddenMs = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    appendTimeline("watch-reset", { engine: ENGINE });
    sample("watch-reset");
  }

  window.SantaLuziaVisualForensics = {
    version: VERSION,
    engine: ENGINE,
    snapshot,
    clear,
    startIncident,
    captureNow: () => sample("manual"),
  };

  window.addEventListener("pagehide", () => {
    appendTimeline("watch-stop", { reason: "pagehide", uptimeMs: Date.now() - startedAt });
    for (const incident of [...active]) finishIncident(incident);
    persistNow();
    clearInterval(timer);
    clearInterval(heartbeat);
    if (scrollTimer) clearTimeout(scrollTimer);
    try { mutations.disconnect(); } catch {}
  });
})();