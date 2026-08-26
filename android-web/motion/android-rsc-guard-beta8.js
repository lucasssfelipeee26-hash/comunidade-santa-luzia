"use strict";

(() => {
  const VERSION = "2.0.0-beta.8";
  const FLAG = "motionRscGuardAndroid";
  const DOC_CACHE = "santa-luzia-motion-documents-v1";
  const RSC_CACHE = "santa-luzia-motion-rsc-v1";
  const STANDARD_PREFIXES = ["santa-luzia-private-v", "santa-luzia-offline-v"];

  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const previousFetch = window.fetch.bind(window);
  let physicalOnline = true;

  function sameOrigin(value) {
    try { return new URL(value, location.href).origin === location.origin; } catch { return false; }
  }

  function canonicalUrl(value) {
    const url = new URL(value, location.href);
    for (const key of ["_rsc", "motionBeta", "sync"]) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  }

  function requestHeaders(input, init) {
    if (init?.headers) return new Headers(init.headers);
    if (input instanceof Request) return new Headers(input.headers);
    return new Headers();
  }

  function isRscRequest(input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const headers = requestHeaders(input, init);
    const accept = String(headers.get("accept") || "").toLowerCase();
    return url.searchParams.has("_rsc") ||
      headers.get("rsc") === "1" ||
      headers.has("next-router-state-tree") ||
      headers.has("next-router-prefetch") ||
      accept.includes("text/x-component");
  }

  function isOffline() {
    return !physicalOnline || document.documentElement.dataset.syncState === "offline";
  }

  function rscCacheKey(value) {
    const canonical = new URL(canonicalUrl(value));
    const encoded = encodeURIComponent(`${canonical.pathname}${canonical.search}`);
    return new Request(`${location.origin}/__santa_luzia_motion_rsc__?route=${encoded}`, { method: "GET" });
  }

  async function standardCacheNames() {
    if (!("caches" in window)) return [];
    const names = await caches.keys().catch(() => []);
    return names.filter((name) => STANDARD_PREFIXES.some((prefix) => name.startsWith(prefix)));
  }

  async function saveDocument(value, response) {
    if (!("caches" in window) || !response?.ok) return;
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/html")) return;
    const key = new Request(canonicalUrl(value), { method: "GET", credentials: "same-origin" });
    try { await (await caches.open(DOC_CACHE)).put(key, response.clone()); } catch {}
  }

  async function saveRsc(value, response) {
    if (!("caches" in window) || !response?.ok) return;
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/x-component") && !type.includes("application/octet-stream") && !type.includes("text/plain")) return;
    try { await (await caches.open(RSC_CACHE)).put(rscCacheKey(value), response.clone()); } catch {}
  }

  async function cachedRsc(value) {
    if (!("caches" in window)) return null;
    try { return (await caches.open(RSC_CACHE)).match(rscCacheKey(value)); } catch { return null; }
  }

  async function documentBackup(value) {
    if (!("caches" in window)) return null;
    const key = new Request(canonicalUrl(value), { method: "GET", credentials: "same-origin" });
    try {
      const direct = await (await caches.open(DOC_CACHE)).match(key);
      if (direct) return direct;
    } catch {}
    for (const name of await standardCacheNames()) {
      try {
        const response = await (await caches.open(name)).match(key);
        const type = String(response?.headers?.get("content-type") || "").toLowerCase();
        if (response && type.includes("text/html")) {
          await saveDocument(value, response.clone());
          return response;
        }
      } catch {}
    }
    return null;
  }

  async function restoreDocument(value, backup) {
    if (!("caches" in window) || !backup) return;
    const key = new Request(canonicalUrl(value), { method: "GET", credentials: "same-origin" });
    try { await (await caches.open(DOC_CACHE)).put(key, backup.clone()); } catch {}
    for (const name of await standardCacheNames()) {
      try { await (await caches.open(name)).put(key, backup.clone()); } catch {}
    }
  }

  async function scrubRscFromDocumentCaches() {
    if (!("caches" in window)) return;
    for (const name of await standardCacheNames()) {
      try {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const request of requests) {
          const response = await cache.match(request);
          const type = String(response?.headers?.get("content-type") || "").toLowerCase();
          if (!response || type.includes("text/html")) continue;
          if (!type.includes("text/x-component")) continue;
          const backup = await (await caches.open(DOC_CACHE)).match(new Request(canonicalUrl(request.url), { method: "GET", credentials: "same-origin" }));
          if (backup) await cache.put(new Request(canonicalUrl(request.url), { method: "GET", credentials: "same-origin" }), backup.clone());
          else await cache.delete(request);
        }
      } catch {}
    }
  }

  async function syncPhysicalNetwork() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (!network?.getStatus) return;
      const status = await network.getStatus();
      if (typeof status?.connected === "boolean") physicalOnline = status.connected;
      if (network.addListener && !window.__santaLuziaBeta8RscNetworkListener) {
        window.__santaLuziaBeta8RscNetworkListener = true;
        await network.addListener("networkStatusChange", (state) => {
          if (typeof state?.connected === "boolean") physicalOnline = state.connected;
        });
      }
    } catch {}
  }

  window.fetch = async function motionRscGuardFetch(input, init) {
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = input instanceof Request ? input.url : String(input);
    if (method !== "GET" || !sameOrigin(url)) return previousFetch(input, init);

    const rsc = isRscRequest(input, init);
    if (rsc && isOffline()) {
      const cached = await cachedRsc(url);
      if (cached) return cached.clone();
      // Sem um payload RSC previamente sincronizado, simula indisponibilidade de rede
      // em vez de entregar HTML no formato errado. O documento atual permanece íntegro.
      return new Response("", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/x-component; charset=utf-8", "X-Santa-Luzia-Offline": "1" },
      });
    }

    if (rsc) {
      const backup = await documentBackup(url);
      try {
        const response = await previousFetch(input, init);
        if (response.ok) await saveRsc(url, response.clone());
        await restoreDocument(url, backup);
        return response;
      } catch (error) {
        await restoreDocument(url, backup);
        const cached = await cachedRsc(url);
        if (cached) return cached.clone();
        throw error;
      }
    }

    const response = await previousFetch(input, init);
    if (response.ok) await saveDocument(url, response.clone());
    return response;
  };

  window.addEventListener("offline", () => { physicalOnline = false; });
  window.addEventListener("online", () => { physicalOnline = true; void syncPhysicalNetwork(); });
  window.addEventListener("focus", () => { void syncPhysicalNetwork(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncPhysicalNetwork();
  });

  void syncPhysicalNetwork();
  void scrubRscFromDocumentCaches();
  setTimeout(() => { void scrubRscFromDocumentCaches(); }, 2500);
})();
