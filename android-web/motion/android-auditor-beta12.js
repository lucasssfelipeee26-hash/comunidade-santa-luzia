"use strict";

(() => {
  const VERSION = "2.0.0-beta.14";
  const STORAGE_KEY = "santa-luzia:auditor:v1";
  const MAX_EVENTS = 700;
  const MAX_TEXT = 420;
  const SLOW_REQUEST_MS = 1200;
  const BAD_FPS = 45;
  const ROOT_FLAG = "auditorBeta14";
  const OFFLINE_DB = "santa-luzia-motion-local-first-v1";
  if (document.documentElement.dataset[ROOT_FLAG] === VERSION) return;
  document.documentElement.dataset[ROOT_FLAG] = VERSION;

  const SAFE_QUERY_KEYS = new Set(["data", "ano", "escopo", "admin"]);
  const CORE_OFFLINE_PATHS = [
    "/api/escalas",
    "/api/formacoes",
    "/api/ranking",
    "/api/perfil",
    "/api/perfis",
    "/api/notificacoes",
    "/api/quizzes",
    "/api/biblioteca",
  ];
  const LOCAL_FALLBACKS = {
    "/api/ranking": ["santa-luzia:offline:v1:ranking"],
    "/api/perfil": ["santa-luzia:offline:v1:meu-perfil"],
    "/api/perfis": ["santa-luzia:perfis-publicos:v1"],
  };

  let events = [];
  let routeStart = 0;
  let lastScrollY = window.scrollY || 0;
  let lastScrollAt = performance.now();
  let scrollGuardUntil = 0;
  let selfAuditRunning = false;
  let lastExport = null;

  function clampText(value, max = MAX_TEXT) {
    const text = String(value ?? "")
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redigido]")
      .replace(/([?&](?:token|auth|session|senha|password|code|codigo)=)[^&\s]+/gi, "$1[redigido]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redigido]");
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function safePath(input) {
    try {
      const url = new URL(String(input), location.href);
      if (url.origin !== location.origin) return `${url.origin}${url.pathname}`;
      const safe = new URL(url.pathname, location.origin);
      for (const [key, value] of url.searchParams.entries()) {
        if (SAFE_QUERY_KEYS.has(key)) safe.searchParams.set(key, clampText(value, 60));
      }
      return `${safe.pathname}${safe.search}`;
    } catch {
      return clampText(input, 180);
    }
  }

  function readStored() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Array.isArray(parsed?.events) ? parsed.events.slice(-MAX_EVENTS) : [];
    } catch { return []; }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), events: events.slice(-MAX_EVENTS) }));
    } catch {}
  }

  events = readStored();

  function physicalNetwork() {
    return document.documentElement.dataset.physicalNetwork || (navigator.onLine ? "desconhecido/online" : "offline");
  }

  function add(type, level, detail = {}) {
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      type,
      level,
      route: `${location.pathname}${location.search}`,
      network: physicalNetwork(),
      ...detail,
    };
    events.push(event);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    persist();
    window.dispatchEvent(new CustomEvent("santa-luzia:diagnostico-updated", { detail: { type, level } }));
    return event;
  }

  function errorDetail(error) {
    if (!error) return { message: "Erro sem detalhes" };
    if (typeof error === "string") return { message: clampText(error) };
    return {
      name: clampText(error.name || "Error", 80),
      message: clampText(error.message || String(error)),
      stack: clampText(error.stack || "", 1800),
    };
  }

  window.addEventListener("error", (event) => {
    add("javascript-error", "error", {
      message: clampText(event.message || event.error?.message || "Erro JavaScript"),
      file: event.filename ? safePath(event.filename) : null,
      line: event.lineno || null,
      column: event.colno || null,
      ...errorDetail(event.error),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    add("unhandled-rejection", "error", errorDetail(event.reason));
  });

  const previousFetch = window.fetch.bind(window);
  window.fetch = async function santaLuziaAuditedFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const path = safePath(url);
    const started = performance.now();
    try {
      const response = await previousFetch(input, init);
      const durationMs = Math.round(performance.now() - started);
      if (!response.ok || durationMs >= SLOW_REQUEST_MS) {
        add("fetch", response.ok ? "warning" : "error", {
          method,
          path,
          status: response.status,
          durationMs,
          slow: durationMs >= SLOW_REQUEST_MS,
        });
      }
      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      add("fetch-error", "error", { method, path, durationMs, ...errorDetail(error) });
      throw error;
    }
  };

  function beginRoute() {
    routeStart = performance.now();
    scrollGuardUntil = performance.now() + 650;
  }

  function finishRoute() {
    const started = routeStart || performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const durationMs = Math.round(performance.now() - started);
      add("route-transition", durationMs > 500 ? "warning" : "info", { durationMs, pathname: location.pathname });
      measureFps();
      auditIcons();
    }));
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin === location.origin && !url.pathname.startsWith("/api/") && url.href !== location.href) beginRoute();
    } catch {}
  }, true);
  window.addEventListener("santa-luzia:local-route", finishRoute);
  window.addEventListener("popstate", () => { beginRoute(); finishRoute(); });

  function measureFps(duration = 1400) {
    const start = performance.now();
    let frames = 0;
    function frame(now) {
      frames += 1;
      if (now - start < duration) return requestAnimationFrame(frame);
      const fps = Math.round((frames * 1000) / Math.max(1, now - start));
      add("fps-sample", fps < BAD_FPS ? "warning" : "info", { fps, durationMs: Math.round(now - start) });
    }
    requestAnimationFrame(frame);
  }

  try {
    if ("PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          add("long-task", entry.duration >= 120 ? "warning" : "info", { durationMs: Math.round(entry.duration), startTime: Math.round(entry.startTime) });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    }
  } catch {}

  window.addEventListener("scroll", () => {
    const now = performance.now();
    const current = window.scrollY || document.scrollingElement?.scrollTop || 0;
    const delta = current - lastScrollY;
    const elapsed = now - lastScrollAt;
    const maxJump = Math.max(650, window.innerHeight * 0.85);
    if (now > scrollGuardUntil && elapsed < 150 && Math.abs(delta) > maxJump) {
      add("scroll-jump", "warning", { from: Math.round(lastScrollY), to: Math.round(current), delta: Math.round(delta), elapsedMs: Math.round(elapsed) });
    }
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (current < -2 || current > maxScroll + 8) add("scroll-out-of-bounds", "warning", { y: Math.round(current), maxScroll: Math.round(maxScroll) });
    lastScrollY = current;
    lastScrollAt = now;
  }, { passive: true });

  function hasVisualIcon(element) {
    return Boolean(element?.querySelector?.("svg,[data-prayer-person-icon],.sl-r10-profile-icon,.sl-r6-clock,.sl-r8-native-clock,.sl-r13-native-clock,.sl-profile-door-icon"));
  }

  function auditIcons() {
    const expected = [
      "/area-restrita/moderador",
      "/area-restrita/atrasos",
      "/area-restrita/ranking",
      "/area-restrita/moderador/escala",
      "/area-restrita/moderador/formacao",
      "/area-restrita/moderador/presencas",
      "/area-restrita/moderador/registro",
      "/area-restrita/moderador/ranking",
      "/area-restrita/moderador/tema",
      "/area-restrita/moderador/diagnostico",
      "/area-restrita/moderador/dados",
      "/area-restrita/membro",
      "/escala",
      "/formacao",
    ];
    const missing = [];
    for (const href of expected) {
      const links = [...document.querySelectorAll(`a[href="${href}"]`)];
      for (const link of links) {
        if (!(link instanceof HTMLElement) || link.offsetParent === null) continue;
        if (!hasVisualIcon(link)) missing.push(href);
      }
    }
    const menuDialog = document.querySelector('nav[aria-label="Menu da Área Restrita"]');
    if (menuDialog) {
      for (const tile of menuDialog.querySelectorAll("a[href]")) if (!hasVisualIcon(tile)) missing.push(tile.getAttribute("href") || "menu-sem-href");
    }
    const unique = [...new Set(missing)].slice(0, 30);
    add("icon-audit", unique.length ? "warning" : "info", { checkedRoutes: expected.length, missing: unique.length, routes: unique });
    if (unique.length) add("missing-icons", "warning", { routes: unique });
    return unique;
  }

  async function storageSnapshot() {
    let localBytes = 0;
    let localKeys = 0;
    try {
      localKeys = localStorage.length;
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || "";
        localBytes += key.length + String(localStorage.getItem(key) || "").length;
      }
    } catch {}
    let cachesInfo = [];
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        for (const name of names) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          cachesInfo.push({ name: clampText(name, 100), entries: keys.length });
        }
      }
    } catch {}
    let databases = [];
    try {
      if (indexedDB.databases) databases = (await indexedDB.databases()).map((db) => ({ name: clampText(db.name || "", 100), version: db.version || 0 }));
    } catch {}
    return { localStorageApproxBytes: localBytes * 2, localStorageKeys: localKeys, caches: cachesInfo, indexedDB: databases };
  }

  async function nativeNetwork() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (network?.getStatus) return await network.getStatus();
    } catch (error) {
      add("network-plugin", "warning", errorDetail(error));
    }
    return { connected: physicalNetwork() !== "offline", connectionType: "unknown" };
  }

  async function databaseHealth() {
    const store = window.Capacitor?.Plugins?.OfflineStore;
    if (!store?.health) return { available: false, ok: false, error: "Plugin OfflineStore indisponível" };
    try {
      const result = await store.health();
      const ok = result?.ok === true && String(result?.integrity || "").toLowerCase() === "ok";
      const detail = {
        available: true,
        ok,
        integrity: clampText(result?.integrity || "unknown", 80),
        journalMode: clampText(result?.journalMode || "unknown", 40),
        version: Number(result?.version || 0),
        documents: Number(result?.documents || 0),
        backups: Number(result?.backups || 0),
        sizeBytes: Number(result?.sizeBytes || 0),
      };
      add("local-db-health", ok ? "info" : "error", detail);
      return detail;
    } catch (error) {
      const detail = { available: true, ok: false, ...errorDetail(error) };
      add("local-db-health", "error", detail);
      return detail;
    }
  }

  function openOfflineDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB indisponível"));
      const req = indexedDB.open(OFFLINE_DB);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Falha ao abrir fila local"));
    });
  }

  async function queueSnapshot() {
    try {
      const db = await openOfflineDb();
      try {
        if (!db.objectStoreNames.contains("mutations")) return { available: true, pending: 0, blocked: 0 };
        const rows = await new Promise((resolve, reject) => {
          const tx = db.transaction("mutations", "readonly");
          const req = tx.objectStore("mutations").getAll();
          req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
          req.onerror = () => reject(req.error || new Error("Falha ao ler fila"));
        });
        return {
          available: true,
          pending: rows.filter((row) => row?.state !== "blocked").length,
          blocked: rows.filter((row) => row?.state === "blocked").length,
          oldestAt: rows.length ? Math.min(...rows.map((row) => Number(row?.createdAt || Date.now()))) : null,
        };
      } finally { db.close(); }
    } catch (error) {
      return { available: false, pending: 0, blocked: 0, error: clampText(error?.message || error) };
    }
  }

  async function findCached(path) {
    if (!("caches" in window)) return null;
    let names = [];
    try { names = await caches.keys(); } catch { return null; }
    const request = new Request(new URL(path, location.href).toString(), { method: "GET", credentials: "same-origin" });
    for (const name of names) {
      if (!name.startsWith("santa-luzia-offline-v") && !name.startsWith("santa-luzia-private-v")) continue;
      try {
        const hit = await (await caches.open(name)).match(request);
        if (hit) return { cache: name, status: hit.status, contentType: hit.headers.get("content-type") || "" };
      } catch {}
    }
    return null;
  }

  function hasLocalFallback(path) {
    const keys = LOCAL_FALLBACKS[path] || [];
    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        if (value && value !== "null" && value !== "[]" && value !== "{}") return key;
      } catch {}
    }
    return null;
  }

  async function offlineReadinessAudit() {
    const results = [];
    for (const path of CORE_OFFLINE_PATHS) {
      const cached = await findCached(path);
      const fallback = cached ? null : hasLocalFallback(path);
      results.push({ path, ok: Boolean(cached || fallback), cache: cached?.cache || null, fallback });
    }
    const queue = await queueSnapshot();
    const database = await databaseHealth();
    const missing = results.filter((item) => !item.ok).map((item) => item.path);
    const level = database.ok === false ? "error" : missing.length >= 5 ? "warning" : "info";
    add("offline-readiness", level, { checked: results.length, available: results.length - missing.length, missing, queue, database });
    return { checked: results.length, available: results.length - missing.length, missing, results, queue, database };
  }

  function fetchWithTimeout(path, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return previousFetch(path, { cache: "no-store", credentials: "same-origin", signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  async function onlineEndpointAudit() {
    const endpoints = [
      "/api/auth/me",
      "/api/escalas",
      "/api/formacoes",
      "/api/ranking",
      "/api/perfil",
      "/api/perfis",
      "/api/notificacoes",
      "/api/quizzes",
      "/api/biblioteca",
      "/api/formacoes/presencas/resumo?escopo=me",
    ];
    let auth = null;
    try {
      const response = await fetchWithTimeout("/api/auth/me", 6500);
      auth = response.ok ? await response.clone().json().catch(() => null) : null;
    } catch {}
    if (auth?.sessao?.tipo === "moderador") endpoints.push(
      "/api/membros",
      "/api/equipe",
      "/api/formacoes/presencas/resumo",
      "/api/quizzes?admin=1",
      "/api/configuracao/tema",
      "/api/app/admin-dados",
    );

    const results = [];
    for (const path of endpoints) {
      const started = performance.now();
      try {
        const response = await fetchWithTimeout(path);
        results.push({ path: safePath(path), ok: response.ok, status: response.status, durationMs: Math.round(performance.now() - started) });
      } catch (error) {
        results.push({ path: safePath(path), ok: false, status: 0, durationMs: Math.round(performance.now() - started), error: clampText(error?.message || error) });
      }
    }
    const failed = results.filter((item) => !item.ok);
    add("online-functional-audit", failed.length ? "error" : "info", { checked: results.length, failed: failed.length, results });
    return { checked: results.length, failed: failed.length, results };
  }

  async function selfAudit() {
    if (selfAuditRunning) return snapshot();
    selfAuditRunning = true;
    add("self-audit-start", "info", {});
    try {
      const net = await nativeNetwork();
      const physicallyOnline = net?.connected !== false && physicalNetwork() !== "offline";
      const offlineReadiness = await offlineReadinessAudit();
      let online = null;
      if (physicallyOnline) online = await onlineEndpointAudit();
      else add("offline-functional-audit", offlineReadiness.missing.length >= 5 ? "warning" : "info", {
        physicalNetwork: "offline",
        checked: offlineReadiness.checked,
        available: offlineReadiness.available,
        missing: offlineReadiness.missing,
        note: "Sem internet física: o Auditor testou armazenamento e recursos locais sem depender do servidor.",
      });
      auditIcons();
      measureFps(1800);
      const storage = await storageSnapshot();
      add("storage-audit", "info", storage);
      add("self-audit-complete", "info", { physicalOnline: physicallyOnline, offlineAvailable: offlineReadiness.available, onlineFailed: online?.failed ?? null });
      return snapshot();
    } catch (error) {
      add("self-audit-failure", "error", errorDetail(error));
      throw error;
    } finally {
      selfAuditRunning = false;
    }
  }

  async function snapshot() {
    const net = await nativeNetwork();
    const storage = await storageSnapshot();
    const database = await databaseHealth();
    const queue = await queueSnapshot();
    const memory = performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    } : null;
    const list = events.slice(-MAX_EVENTS);
    const summary = {
      errors: list.filter((event) => event.level === "error").length,
      warnings: list.filter((event) => event.level === "warning").length,
      slowRequests: list.filter((event) => event.type === "fetch" && event.slow).length,
      lowFpsSamples: list.filter((event) => event.type === "fps-sample" && event.fps < BAD_FPS).length,
      scrollJumps: list.filter((event) => event.type === "scroll-jump").length,
      missingIconAudits: list.filter((event) => event.type === "missing-icons").length,
      blockedMutations: Number(queue?.blocked || 0),
    };
    return {
      schema: "santa-luzia-diagnostico-v2",
      generatedAt: new Date().toISOString(),
      app: { version: VERSION, route: `${location.pathname}${location.search}`, userAgent: clampText(navigator.userAgent, 500) },
      device: { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, language: navigator.language, platform: navigator.platform || null, memory },
      network: { physical: physicalNetwork(), native: net },
      storage,
      database,
      queue,
      summary,
      events: list,
      lastExport,
      privacy: "Relatório técnico sem cookies, senhas, tokens, corpos de requisição ou conteúdo pessoal deliberadamente coletado.",
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
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }

  async function exportReport() {
    const report = await snapshot();
    const fileName = reportName();
    const content = JSON.stringify(report, null, 2);
    const native = window.Capacitor?.Plugins?.DiagnosticReport;
    let saved;
    if (native?.saveReport) {
      saved = await native.saveReport({ fileName, content });
      saved = { ...saved, method: "android-native" };
    } else {
      saved = await browserDownload(fileName, content);
    }
    lastExport = { at: Date.now(), ...saved };
    add("report-exported", "info", { events: report.events.length, fileName, method: saved.method, location: clampText(saved.location || saved.uri || "", 220) });
    return { ...report, export: saved };
  }

  async function shareLastReport() {
    const native = window.Capacitor?.Plugins?.DiagnosticReport;
    if (!native?.shareLastReport) throw new Error("Compartilhamento nativo indisponível.");
    const result = await native.shareLastReport();
    add("report-shared", "info", { fileName: lastExport?.fileName || null });
    return result;
  }

  function clear() {
    events = [];
    persist();
    window.dispatchEvent(new CustomEvent("santa-luzia:diagnostico-updated", { detail: { type: "clear" } }));
  }

  window.SantaLuziaAuditor = {
    version: VERSION,
    getEvents: () => events.slice(),
    snapshot,
    runSelfAudit: selfAudit,
    exportReport,
    shareLastReport,
    clear,
    add,
    auditIcons,
    databaseHealth,
    offlineReadinessAudit,
  };

  add("auditor-ready", "info", { version: VERSION, mode: "online-offline" });
  setTimeout(() => { auditIcons(); measureFps(1200); void databaseHealth(); }, 1200);
})();
