"use strict";

(() => {
  const VERSION = "2.0.0-beta.1";
  const ROOT_FLAG = "motionBetaAndroid";
  const DELAY_SEEN_PREFIX = "santa-luzia:motion-beta:atraso-visto:";
  const DELAY_REFRESH_MS = 15_000;
  let scheduled = false;
  let delayBusy = false;
  let lastDelayCheck = 0;

  if (document.documentElement.dataset[ROOT_FLAG] === VERSION) return;
  document.documentElement.dataset[ROOT_FLAG] = VERSION;

  function text(element) {
    return String(element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function motionReduced() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }

  function addStyles() {
    if (document.getElementById("sl-motion-beta-android-style")) return;
    const style = document.createElement("style");
    style.id = "sl-motion-beta-android-style";
    style.textContent = `
      html[data-motion-beta-android] { background:#fffaf0; }
      .sl-motion-beta-delay { position:sticky; top:8px; z-index:68; width:calc(100% - 16px); max-width:768px; margin:8px auto 0; border:1px solid rgba(217,169,52,.58); border-radius:18px; background:rgba(255,253,249,.96); box-shadow:0 14px 40px rgba(72,50,20,.14); backdrop-filter:blur(16px); padding:12px; color:#493a32; }
      .sl-motion-beta-delay-row { display:flex; align-items:flex-start; gap:10px; }
      .sl-motion-beta-delay-icon { display:grid; place-items:center; width:40px; height:40px; flex:0 0 40px; border-radius:14px; background:#fff1c9; color:#7b1326; font-size:20px; }
      .sl-motion-beta-delay-copy { min-width:0; flex:1; }
      .sl-motion-beta-delay-copy strong { display:block; color:#4c2429; font-size:13px; }
      .sl-motion-beta-delay-copy p { margin:3px 0 0; color:#75676a; font-size:12px; line-height:1.45; }
      .sl-motion-beta-delay-close { display:grid; place-items:center; width:32px; height:32px; flex:0 0 32px; border:0; border-radius:999px; background:#f7eee8; color:#725f61; font-size:18px; }
      @keyframes slMotionBetaDelayIn { 0%{opacity:0;transform:translateY(-8px) scale(.985)} 70%{opacity:1;transform:translateY(1px) scale(1.002)} 100%{opacity:1;transform:none} }
      .sl-motion-beta-delay { animation:slMotionBetaDelayIn 420ms cubic-bezier(.2,.78,.2,1) both; }
      @media (prefers-reduced-motion:reduce) {
        .sl-motion-beta-delay { animation:none !important; }
        *,*::before,*::after { scroll-behavior:auto !important; }
      }
    `;
    document.head?.appendChild(style);
  }

  function isFormationRoute() {
    return location.pathname === "/formacao" || /Central de Formação/.test(text(document.body));
  }

  function trimFormationHistory() {
    if (!isFormationRoute()) return;
    const headings = [...document.querySelectorAll("main h1,main h2,main h3")];
    const historyHeading = headings.find((node) => /Histórico de formações|Formação mais recente|Histórico anterior/i.test(text(node)));
    const section = historyHeading?.closest("section") || headings.find((node) => /Histórico de formações/i.test(text(node)))?.closest("section");
    if (!section) return;

    const mainHeading = [...section.querySelectorAll("h1,h2,h3")].find((node) => /Histórico de formações|Formação mais recente/i.test(text(node)));
    if (mainHeading && /Histórico de formações/i.test(text(mainHeading))) {
      const icon = mainHeading.querySelector("svg")?.outerHTML || "";
      mainHeading.innerHTML = `${icon} Formação mais recente`;
    }

    section.querySelectorAll("details").forEach((details) => {
      if (/Histórico anterior/i.test(text(details.querySelector("summary")))) details.remove();
    });

    const articles = [...section.querySelectorAll(":scope article, :scope > div article")].filter((item) => item instanceof HTMLElement);
    articles.slice(1).forEach((item) => item.remove());
  }

  function removeLegacyDelayBanner() {
    document.querySelectorAll("aside").forEach((aside) => {
      if (/Registro de pontualidade confirmado/i.test(text(aside)) && !aside.classList.contains("sl-motion-beta-delay")) aside.remove();
    });
  }

  async function fetchRanking() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(`/api/ranking?motionBeta=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json().catch(() => null);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function viewerId(data) {
    return String(data?.eu?.id || data?.usuario?.id || data?.usuarioId || "").trim();
  }

  function latestConfirmed(data) {
    const list = Array.isArray(data?.ocorrencias) ? data.ocorrencias : [];
    return list
      .filter((item) => item && item.status === "confirmado" && item.id)
      .sort((a, b) => Number(b.criado_em || 0) - Number(a.criado_em || 0))[0] || null;
  }

  function seenKey(userId, occurrenceId) {
    return `${DELAY_SEEN_PREFIX}${userId}:${occurrenceId}`;
  }

  function formatDate(value) {
    const raw = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }

  function renderDelayBanner(userId, occurrence) {
    if (document.querySelector(".sl-motion-beta-delay")) return;
    const key = seenKey(userId, String(occurrence.id));
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch {}

    const banner = document.createElement("aside");
    banner.className = "sl-motion-beta-delay";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    const name = String(occurrence.usuario_nome || "Um membro");
    const date = formatDate(occurrence.data_missa);
    banner.innerHTML = `
      <div class="sl-motion-beta-delay-row">
        <span class="sl-motion-beta-delay-icon" aria-hidden="true">⏰</span>
        <div class="sl-motion-beta-delay-copy">
          <strong>Registro de pontualidade confirmado</strong>
          <p>${name.replace(/[<>&]/g, "")} teve um atraso confirmado${date ? ` na celebração de ${date}` : ""}.</p>
        </div>
        <button type="button" class="sl-motion-beta-delay-close" aria-label="Fechar aviso">×</button>
      </div>`;

    const host = document.querySelector("main")?.parentElement || document.body;
    host.insertBefore(banner, host.firstChild);
    banner.querySelector("button")?.addEventListener("click", () => banner.remove());

    // "Visto" significa que o banner realmente chegou a ser exibido neste perfil.
    // A chave inclui o usuário para que duas contas no mesmo aparelho não compartilhem a leitura.
    setTimeout(() => {
      if (!banner.isConnected) return;
      try { localStorage.setItem(key, "1"); } catch {}
    }, 1200);

    if (!motionReduced() && typeof banner.animate === "function") {
      try { banner.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.78,.2,1)" }); } catch {}
    }
  }

  async function refreshDelayBanner(force = false) {
    removeLegacyDelayBanner();
    const now = Date.now();
    if (delayBusy || (!force && now - lastDelayCheck < DELAY_REFRESH_MS)) return;
    delayBusy = true;
    lastDelayCheck = now;
    try {
      const data = await fetchRanking();
      const userId = viewerId(data);
      const occurrence = latestConfirmed(data);
      if (!userId || !occurrence) return;
      const key = seenKey(userId, String(occurrence.id));
      try { if (localStorage.getItem(key) === "1") return; } catch {}
      renderDelayBanner(userId, occurrence);
    } finally {
      delayBusy = false;
    }
  }

  function warmOriginalInterface() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      const target = registration.active || registration.waiting || registration.installing;
      target?.postMessage({ tipo: "AQUECER_CACHE_PRIVADO", origem: "motion-beta-android" });
    }).catch(() => undefined);
  }

  function apply() {
    addStyles();
    trimFormationHistory();
    removeLegacyDelayBanner();
    void refreshDelayBanner(false);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  addStyles();
  apply();
  warmOriginalInterface();
  setTimeout(() => { apply(); warmOriginalInterface(); void refreshDelayBanner(true); }, 900);
  setTimeout(() => { apply(); warmOriginalInterface(); }, 3200);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-state", "aria-current"] });

  window.addEventListener("online", () => { warmOriginalInterface(); void refreshDelayBanner(true); });
  window.addEventListener("focus", () => { schedule(); warmOriginalInterface(); void refreshDelayBanner(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { schedule(); warmOriginalInterface(); void refreshDelayBanner(true); }
  });

  setInterval(() => {
    schedule();
    if (navigator.onLine) void refreshDelayBanner(false);
  }, DELAY_REFRESH_MS);
})();
