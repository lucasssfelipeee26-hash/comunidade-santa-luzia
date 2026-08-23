"use strict";

(() => {
  const VERSION = "2.0.0-beta.7";
  const ROOT_FLAG = "motionOfflineFirstAndroid";
  const LAST_WARM_KEY = "santa-luzia:motion-beta7:last-warm";
  const LAST_USER_KEY = "santa-luzia:motion-beta7:last-user";
  const WARM_INTERVAL_MS = 15 * 60 * 1000;
  const OFFLINE_CACHE_PREFIX = "santa-luzia-offline-v";
  const PRIVATE_CACHE_PREFIX = "santa-luzia-private-v";
  const FALLBACK_OFFLINE_CACHE = "santa-luzia-offline-v22";
  const FALLBACK_PRIVATE_CACHE = "santa-luzia-private-v3";

  if (document.documentElement.dataset[ROOT_FLAG] === VERSION) return;
  document.documentElement.dataset[ROOT_FLAG] = VERSION;

  const nativeFetch = window.fetch.bind(window);
  let warmPromise = null;
  let lastKnownUser = "";

  const PUBLIC_ROUTES = ["/", "/liturgia", "/escala", "/biblioteca", "/visitante"];
  const MEMBER_ROUTES = [
    "/area-restrita/membro",
    "/area-restrita/perfis",
    "/area-restrita/ranking",
    "/area-restrita/atrasos",
    "/area-restrita/jogo",
    "/formacao",
  ];
  const MODERATOR_ROUTES = [
    "/area-restrita/moderador",
    "/area-restrita/perfis",
    "/area-restrita/ranking",
    "/area-restrita/atrasos",
    "/area-restrita/jogo",
    "/area-restrita/moderador/escala",
    "/area-restrita/moderador/formacao",
    "/area-restrita/moderador/presencas",
    "/area-restrita/moderador/registro",
    "/area-restrita/moderador/ranking",
    "/area-restrita/moderador/tema",
    "/area-restrita/moderador/acervo-liturgico",
    "/formacao",
  ];
  const COMMON_APIS = [
    "/api/auth/me",
    "/api/escalas",
    "/api/formacoes",
    "/api/ranking",
    "/api/perfis",
    "/api/notificacoes",
  ];
  const MODERATOR_APIS = [
    "/api/membros",
    "/api/equipe",
    "/api/formacoes/presencas/resumo",
  ];

  function offlineNow() {
    return navigator.onLine === false || document.documentElement.dataset.syncState === "offline";
  }

  function sameOrigin(url) {
    try { return new URL(url, location.href).origin === location.origin; } catch { return false; }
  }

  function normalizeUrl(value) {
    const url = new URL(value, location.href);
    for (const key of ["motionBeta", "sync", "_rsc"]) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  }

  function cacheVersion(name, prefix) {
    const raw = name.startsWith(prefix) ? name.slice(prefix.length) : "";
    const number = Number.parseInt(raw, 10);
    return Number.isFinite(number) ? number : -1;
  }

  async function discoverCacheName(prefix, fallback) {
    if (!("caches" in window)) return fallback;
    const names = await caches.keys().catch(() => []);
    return names
      .filter((name) => name.startsWith(prefix))
      .sort((a, b) => cacheVersion(b, prefix) - cacheVersion(a, prefix))[0] || fallback;
  }

  async function cacheHandles() {
    if (!("caches" in window)) return { offline: null, privateCache: null };
    const [offlineName, privateName] = await Promise.all([
      discoverCacheName(OFFLINE_CACHE_PREFIX, FALLBACK_OFFLINE_CACHE),
      discoverCacheName(PRIVATE_CACHE_PREFIX, FALLBACK_PRIVATE_CACHE),
    ]);
    const [offline, privateCache] = await Promise.all([caches.open(offlineName), caches.open(privateName)]);
    return { offline, privateCache };
  }

  function requestFor(value) {
    return new Request(normalizeUrl(value), { method: "GET", credentials: "same-origin" });
  }

  async function putSafe(cache, value, response) {
    if (!cache || !response?.ok) return;
    try { await cache.put(requestFor(value), response.clone()); } catch {}
  }

  async function matchCached(value) {
    if (!("caches" in window)) return null;
    const key = requestFor(value);
    const { privateCache, offline } = await cacheHandles();
    return (await privateCache?.match(key).catch(() => null)) || (await offline?.match(key).catch(() => null)) || null;
  }

  function shouldPersistGet(url) {
    return sameOrigin(url) && new URL(url, location.href).pathname.startsWith("/api/");
  }

  function isPublicApi(pathname) {
    return pathname === "/api/escalas" || pathname === "/api/biblioteca" || pathname.startsWith("/api/liturgia");
  }

  async function persistGet(url, response) {
    if (!response?.ok || !shouldPersistGet(url)) return;
    const parsed = new URL(url, location.href);
    const { offline, privateCache } = await cacheHandles();
    await putSafe(isPublicApi(parsed.pathname) ? offline : privateCache, parsed.toString(), response);
  }

  window.fetch = async function motionOfflineFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    if (method !== "GET" || !sameOrigin(url)) return nativeFetch(input, init);

    if (!offlineNow()) {
      try {
        const response = await nativeFetch(input, init);
        if (response.ok) void persistGet(url, response.clone());
        return response;
      } catch (error) {
        const cached = await matchCached(url);
        if (cached) return cached;
        throw error;
      }
    }

    const parsed = new URL(url, location.href);
    if (parsed.searchParams.has("_rsc") || request?.headers?.get("RSC") === "1") {
      return nativeFetch(input, init);
    }
    const cached = await matchCached(url);
    if (cached) return cached;
    return nativeFetch(input, init);
  };

  async function clearPrivateRouteCopies() {
    if (!("caches" in window)) return;
    const { offline } = await cacheHandles();
    if (!offline) return;
    const routes = [...MEMBER_ROUTES, ...MODERATOR_ROUTES];
    await Promise.all(routes.map((route) => offline.delete(requestFor(route)).catch(() => false)));
  }

  function extractStaticAssets(html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const urls = new Set();
      doc.querySelectorAll("script[src],link[href],img[src]").forEach((node) => {
        const raw = node.getAttribute("src") || node.getAttribute("href");
        if (!raw) return;
        const url = new URL(raw, location.origin);
        if (url.origin === location.origin && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/icons/") || /\.(?:css|js|woff2?|png|jpe?g|svg|webp)$/i.test(url.pathname))) urls.add(url.toString());
      });
      return [...urls];
    } catch { return []; }
  }

  async function warmAsset(url, offline) {
    if (!offline) return;
    try {
      if (await offline.match(requestFor(url))) return;
      const response = await nativeFetch(url, { cache: "reload", credentials: "same-origin" });
      if (response.ok) await putSafe(offline, url, response);
    } catch {}
  }

  async function warmRoute(route, privateRoute) {
    if (offlineNow()) return false;
    try {
      const response = await nativeFetch(route, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "text/html", "X-Santa-Luzia-Motion-Beta": "1" },
      });
      if (!response.ok) return false;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return false;
      const html = await response.clone().text();
      const { offline, privateCache } = await cacheHandles();
      await putSafe(offline, route, response);
      if (privateRoute) await putSafe(privateCache, route, response);
      await Promise.all(extractStaticAssets(html).slice(0, 80).map((asset) => warmAsset(asset, offline)));
      return true;
    } catch { return false; }
  }

  async function warmApi(api) {
    if (offlineNow()) return false;
    try {
      const response = await nativeFetch(api, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return false;
      await persistGet(api, response.clone());
      return true;
    } catch { return false; }
  }

  async function readSession() {
    try {
      const response = await nativeFetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return null;
      await persistGet("/api/auth/me", response.clone());
      const data = await response.json().catch(() => null);
      return data?.sessao || null;
    } catch { return null; }
  }

  async function warmEverything(force = false) {
    if (offlineNow()) return;
    if (warmPromise) return warmPromise;
    const last = Number(localStorage.getItem(LAST_WARM_KEY) || 0);
    if (!force && Date.now() - last < WARM_INTERVAL_MS) return;

    warmPromise = (async () => {
      const session = await readSession();
      const userId = String(session?.usuario?.id || "");
      const type = String(session?.tipo || "");
      const previousUser = localStorage.getItem(LAST_USER_KEY) || "";
      if (previousUser && userId && previousUser !== userId) await clearPrivateRouteCopies();
      if (userId) {
        lastKnownUser = userId;
        localStorage.setItem(LAST_USER_KEY, userId);
      }

      const privateRoutes = type === "moderador" ? MODERATOR_ROUTES : type === "membro" ? MEMBER_ROUTES : [];
      for (const route of PUBLIC_ROUTES) await warmRoute(route, false);
      for (const route of privateRoutes) await warmRoute(route, true);

      const apis = [...COMMON_APIS, ...(type === "moderador" ? MODERATOR_APIS : [])];
      if (userId) apis.push(`/api/membros/${encodeURIComponent(userId)}`);
      for (const api of apis) await warmApi(api);

      localStorage.setItem(LAST_WARM_KEY, String(Date.now()));
      try {
        const registration = await navigator.serviceWorker?.ready;
        const target = registration?.active || registration?.waiting || registration?.installing;
        target?.postMessage({ tipo: "AQUECER_CACHE_PRIVADO", origem: "motion-beta7-android" });
      } catch {}
    })().finally(() => { warmPromise = null; });
    return warmPromise;
  }

  function linkFromEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return null;
    if (anchor.target && anchor.target !== "_self") return null;
    try {
      const url = new URL(anchor.href, location.href);
      return url.origin === location.origin ? url : null;
    } catch { return null; }
  }

  document.addEventListener("pointerdown", (event) => {
    if (offlineNow()) return;
    const url = linkFromEvent(event);
    if (!url || url.pathname.startsWith("/api/")) return;
    const privateRoute = url.pathname.startsWith("/area-restrita/") || url.pathname === "/formacao";
    void warmRoute(`${url.pathname}${url.search}`, privateRoute);
  }, true);

  document.addEventListener("click", (event) => {
    const text = String(event.target instanceof Element ? event.target.closest("button,a")?.textContent || "" : "").trim();
    if (/^(sair|encerrar sessão)$/i.test(text)) {
      void clearPrivateRouteCopies();
      try {
        localStorage.removeItem(LAST_USER_KEY);
        localStorage.removeItem(LAST_WARM_KEY);
      } catch {}
      lastKnownUser = "";
    }

    if (!offlineNow()) return;
    const url = linkFromEvent(event);
    if (!url || url.pathname.startsWith("/api/")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = `${url.pathname}${url.search}${url.hash}`;
    window.location.assign(target);
  }, true);

  window.addEventListener("online", () => void warmEverything(true));
  window.addEventListener("focus", () => { if (!offlineNow()) void warmEverything(false); });
  window.addEventListener("santa-luzia:server-sync", () => { if (!offlineNow()) void warmEverything(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !offlineNow()) void warmEverything(false);
  });

  setTimeout(() => void warmEverything(false), 650);
  setTimeout(() => void warmEverything(false), 3500);
})();
