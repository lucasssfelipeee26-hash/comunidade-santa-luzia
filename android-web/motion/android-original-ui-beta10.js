"use strict";

(() => {
  const VERSION = "2.0.0-beta.10";
  const FLAG = "motionOriginalUiBeta10";
  const LAST_WARM = "santa-luzia:beta10:last-data-warm";
  const WARM_INTERVAL = 5 * 60 * 1000;
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  let warming = null;
  const COMMON_APIS = [
    "/api/auth/me",
    "/api/escalas",
    "/api/formacoes",
    "/api/ranking",
    "/api/perfil",
    "/api/perfis",
    "/api/notificacoes",
    "/api/quizzes",
    "/api/biblioteca",
  ];
  const MODERATOR_APIS = [
    "/api/membros",
    "/api/equipe",
    "/api/formacoes/presencas/resumo",
    "/api/quizzes?admin=1",
    "/api/configuracao/tema",
    "/api/acervo-liturgico",
  ];

  async function physicallyOnline() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (network?.getStatus) return !!(await network.getStatus())?.connected;
    } catch {}
    return false;
  }

  async function getJson(path) {
    try {
      const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return null;
      return await response.clone().json().catch(() => null);
    } catch { return null; }
  }

  async function warmMemberDetails() {
    const data = await getJson("/api/membros");
    const members = Array.isArray(data?.membros) ? data.membros : [];
    for (const member of members.slice(0, 160)) {
      if (!member?.id) continue;
      await getJson(`/api/membros/${encodeURIComponent(member.id)}`);
    }
  }

  async function warm(force = false) {
    if (!(await physicallyOnline())) return;
    if (warming) return warming;
    const last = Number(localStorage.getItem(LAST_WARM) || 0);
    if (!force && Date.now() - last < WARM_INTERVAL) return;

    warming = (async () => {
      const auth = await getJson("/api/auth/me");
      const session = auth?.sessao;
      if (!session?.usuario?.id) return;
      const apis = [...COMMON_APIS, ...(session.tipo === "moderador" ? MODERATOR_APIS : [])];
      for (const api of apis) await getJson(api);
      if (session.tipo === "moderador") await warmMemberDetails();
      localStorage.setItem(LAST_WARM, String(Date.now()));
      window.dispatchEvent(new CustomEvent("santa-luzia:beta10-data-ready", { detail: { tipo: session.tipo } }));
    })().finally(() => { warming = null; });
    return warming;
  }

  window.addEventListener("online", () => void warm(true));
  window.addEventListener("focus", () => void warm(false));
  window.addEventListener("santa-luzia:server-sync", () => void warm(true));
  window.addEventListener("santa-luzia:offline-snapshot-sync", () => void warm(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void warm(false); });
  setTimeout(() => void warm(false), 800);
  setTimeout(() => void warm(false), 3500);
})();
