"use strict";

(() => {
  const VERSION = "2.0.0-beta.10";
  const FLAG = "motionOriginalUiBeta10";
  const LAST_ROUTE = "santa-luzia:beta10:last-auth-route";
  const LAST_WARM = "santa-luzia:beta10:last-full-warm";
  const WARM_INTERVAL = 10 * 60 * 1000;

  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let warming = null;

  const PUBLIC_ROUTES = [
    "/",
    "/liturgia",
    "/escala",
    "/formacao",
    "/biblioteca",
    "/visitante",
  ];

  const MEMBER_ROUTES = [
    "/area-restrita/membro",
    "/area-restrita/perfil",
    "/area-restrita/perfis",
    "/area-restrita/ranking",
    "/area-restrita/atrasos",
    "/area-restrita/jogo",
    "/formacao",
    "/escala",
    "/biblioteca",
  ];

  const MODERATOR_ROUTES = [
    "/area-restrita/moderador",
    "/area-restrita/perfil",
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
    "/escala",
    "/biblioteca",
  ];

  const COMMON_APIS = [
    "/api/auth/me",
    "/api/escalas",
    "/api/formacoes",
    "/api/ranking",
    "/api/perfil",
    "/api/perfis",
    "/api/notificacoes",
    "/api/quizzes",
    "/api/quizzes/liturgia",
    "/api/biblioteca",
    "/api/liturgia-local",
  ];

  const MODERATOR_APIS = [
    "/api/membros",
    "/api/equipe",
    "/api/formacoes/presencas/resumo",
    "/api/quizzes?admin=1",
    "/api/configuracao/tema",
    "/api/acervo-liturgico",
  ];

  function sameOrigin(value) {
    try { return new URL(value, location.href).origin === location.origin; }
    catch { return false; }
  }

  async function physicallyOnline() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (network?.getStatus) {
        const status = await network.getStatus();
        return !!status?.connected;
      }
    } catch {}
    return navigator.onLine !== false;
  }

  async function auth() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      return data?.sessao || null;
    } catch { return null; }
  }

  function rememberAuthenticatedRoute(session) {
    if (!session?.usuario?.id) return;
    const path = `${location.pathname}${location.search}`;
    if (path.startsWith("/area-restrita/login") || path.startsWith("/area-restrita/cadastro")) return;
    try { localStorage.setItem(LAST_ROUTE, path); } catch {}
  }

  async function warmRoute(path) {
    try {
      const response = await fetch(path, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "text/html", "X-Santa-Luzia-Motion-Beta": "10" },
      });
      return response.ok;
    } catch { return false; }
  }

  async function warmApi(path) {
    try {
      const response = await fetch(path, { method: "GET", cache: "no-store", credentials: "same-origin" });
      return response.ok ? response : null;
    } catch { return null; }
  }

  async function warmMemberDetails() {
    const response = await warmApi("/api/membros");
    if (!response) return;
    const data = await response.clone().json().catch(() => null);
    const members = Array.isArray(data?.membros) ? data.membros : Array.isArray(data) ? data : [];
    for (const member of members.slice(0, 120)) {
      if (!member?.id) continue;
      await warmApi(`/api/membros/${encodeURIComponent(member.id)}`);
    }
  }

  async function warmDiscoveredLinks() {
    const links = new Set();
    document.querySelectorAll("a[href]").forEach((anchor) => {
      try {
        const url = new URL(anchor.getAttribute("href") || "", location.href);
        if (url.origin === location.origin && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/_next/")) {
          links.add(`${url.pathname}${url.search}`);
        }
      } catch {}
    });
    for (const path of [...links].slice(0, 100)) await warmRoute(path);
  }

  async function fullWarm(force = false) {
    if (!(await physicallyOnline())) return;
    if (warming) return warming;
    const last = Number(localStorage.getItem(LAST_WARM) || 0);
    if (!force && Date.now() - last < WARM_INTERVAL) return;

    warming = (async () => {
      const session = await auth();
      if (!session?.usuario?.id) return;
      rememberAuthenticatedRoute(session);
      const routes = session.tipo === "moderador" ? MODERATOR_ROUTES : MEMBER_ROUTES;
      const apis = [...COMMON_APIS, ...(session.tipo === "moderador" ? MODERATOR_APIS : [])];

      // Primeiro aquece o documento de entrada autenticado. Depois, todas as telas
      // originais e APIs que alimentam os componentes React.
      await warmRoute("/");
      for (const route of PUBLIC_ROUTES) await warmRoute(route);
      for (const route of routes) await warmRoute(route);
      for (const api of apis) await warmApi(api);
      if (session.tipo === "moderador") await warmMemberDetails();
      await warmDiscoveredLinks();
      localStorage.setItem(LAST_WARM, String(Date.now()));
      window.dispatchEvent(new CustomEvent("santa-luzia:beta10-cache-ready", { detail: { tipo: session.tipo } }));
    })().finally(() => { warming = null; });
    return warming;
  }

  async function recoverAuthenticatedOfflineRoute() {
    if (await physicallyOnline()) return;
    if (!location.pathname.startsWith("/area-restrita/login") && location.pathname !== "/") return;
    const session = await auth();
    if (!session?.usuario?.id) return;
    let route = "";
    try { route = localStorage.getItem(LAST_ROUTE) || ""; } catch {}
    if (!route || route.startsWith("/area-restrita/login")) {
      route = session.tipo === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro";
    }
    if (`${location.pathname}${location.search}` !== route) location.replace(route);
  }

  // Qualquer navegação autenticada vira um checkpoint para a próxima abertura offline.
  setTimeout(async () => {
    const session = await auth();
    rememberAuthenticatedRoute(session);
    if (await physicallyOnline()) void fullWarm(false);
    else void recoverAuthenticatedOfflineRoute();
  }, 500);

  setTimeout(() => void fullWarm(false), 2200);
  setTimeout(() => void fullWarm(false), 6000);

  window.addEventListener("focus", () => void fullWarm(false));
  window.addEventListener("online", () => void fullWarm(true));
  window.addEventListener("santa-luzia:server-sync", () => void fullWarm(true));
  window.addEventListener("hashchange", () => void fullWarm(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void fullWarm(false);
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a[href],button") : null;
    if (!target) return;
    const text = String(target.textContent || "").trim();
    if (/^(sair|encerrar sessão)$/i.test(text)) {
      try {
        localStorage.removeItem(LAST_ROUTE);
        localStorage.removeItem(LAST_WARM);
      } catch {}
      return;
    }
    if (target instanceof HTMLAnchorElement && sameOrigin(target.href)) {
      setTimeout(() => void fullWarm(false), 350);
    }
  }, true);
})();