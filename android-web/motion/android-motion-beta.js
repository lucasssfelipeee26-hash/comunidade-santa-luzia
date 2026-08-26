"use strict";

// Santa Luzia Motion Beta — camada complementar de comportamento Android.
(() => {
  const VERSION = "2.0.0-beta.15";
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

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

      .public-home a[data-sl-home-shortcut-card="true"]{position:relative;padding-right:58px!important;overflow:hidden}
      .sl-home-runtime-icon{position:absolute;right:14px;top:14px;display:grid;place-items:center;width:38px;height:38px;border-radius:14px;border:1px solid rgba(123,19,38,.10);background:linear-gradient(145deg,#fffaf0,#fff);color:#7b1326;box-shadow:0 6px 16px rgba(80,25,36,.08)}
      .sl-home-runtime-icon svg{width:19px;height:19px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
      .public-home a[data-sl-home-shortcut-card="true"]:active .sl-home-runtime-icon{transform:scale(.92)}
      .sl-home-fourth-card{min-width:0;border:1px solid #d9cfb9;background:#fffdf7;border-radius:12px;padding:12px;box-shadow:0 4px 14px rgba(72,55,21,.06);color:inherit;text-decoration:none}
      .sl-home-fourth-card h2{font-family:serif;font-size:15px;font-weight:600;line-height:1.2;color:#5b071b;margin:0}
      .sl-home-fourth-card p{margin:6px 0 0;font-size:10px;line-height:16px;color:#5f5a4e}
      .sl-home-fourth-card .sl-home-fourth-cta{display:inline-block;margin-top:8px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#9a731d}

      .sl-scale-history-tools{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;padding:12px;border:1px solid rgba(123,19,38,.13);border-radius:16px;background:rgba(255,255,255,.88);box-shadow:0 6px 18px rgba(74,29,38,.05)}
      .sl-scale-history-field{display:grid;gap:4px;min-width:0}
      .sl-scale-history-field label{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7b1326}
      .sl-scale-history-field input{width:100%;min-height:38px;border:1px solid #ded3ca;border-radius:11px;background:#fff;padding:7px 9px;font:600 11px/1.2 system-ui;color:#493a32;outline:none}
      .sl-scale-history-field input:focus{border-color:#9a3148;box-shadow:0 0 0 2px rgba(123,19,38,.08)}
      .sl-scale-history-clear{min-height:38px;border:1px solid #d9cec7;border-radius:11px;background:#fff;padding:0 12px;font:700 10px/1 system-ui;color:#7b1326}
      .sl-scale-history-summary{grid-column:1/-1;margin:0;font:500 10px/1.45 system-ui;color:#766b66}
      [data-sl-history-hidden="true"]{display:none!important}
      @media(max-width:520px){.sl-scale-history-tools{grid-template-columns:1fr 1fr}.sl-scale-history-clear{grid-column:1/-1}.sl-scale-history-summary{grid-column:1/-1}}
      @media (prefers-reduced-motion:reduce) {
        .sl-motion-beta-delay { animation:none !important; }
        *,*::before,*::after { scroll-behavior:auto !important; }
      }
    `;
    document.head?.appendChild(style);
  }

  const HOME_ICONS = {
    "/liturgia": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H10a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2H4.5A2.5 2.5 0 0 0 2 20.5z"/><path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H14a2 2 0 0 0-2 2v16a2 2 0 0 1 2-2h5.5a2.5 2.5 0 0 1 2.5 2.5z"/></svg>',
    "/escala": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="17" rx="2"/><path d="m9 16 2 2 4-4"/></svg>',
    "/biblioteca": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h7"/></svg>',
    "/visitante#liturgia": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  };

  function ensureFourthHomeCard() {
    const root = document.querySelector(".public-home");
    if (!root || root.querySelector('[data-sl-home-generated-fourth="true"]')) return;
    const headings = [...root.querySelectorAll("h2")];
    const biblioteca = headings.find((node) => /Biblioteca/i.test(text(node)))?.closest("a");
    const escala = headings.find((node) => /Escala do Dia/i.test(text(node)))?.closest("a");
    const centro = headings.find((node) => /Centro Litúrgico/i.test(text(node)))?.closest("a");
    const cards = [centro, escala, biblioteca].filter(Boolean);
    if (cards.length < 3) return;
    const grid = biblioteca?.parentElement;
    if (!grid) return;

    const card = document.createElement("a");
    card.href = "/visitante#liturgia";
    card.className = "sl-home-fourth-card";
    card.setAttribute("data-sl-home-generated-fourth", "true");
    card.setAttribute("data-sl-home-shortcut-card", "true");
    card.innerHTML = '<h2>Liturgia Diária</h2><p>Consulte as leituras e o Evangelho do dia diretamente no aplicativo.</p><span class="sl-home-fourth-cta">Ler liturgia →</span>';
    grid.appendChild(card);
  }

  function ensureHomeShortcutIcons() {
    const root = document.querySelector(".public-home");
    if (!root) return;
    for (const [href, svg] of Object.entries(HOME_ICONS)) {
      for (const link of root.querySelectorAll(`a[href="${href}"]`)) {
        if (!link.querySelector("h2") || link.querySelector(":scope > .sl-home-runtime-icon")) continue;
        link.setAttribute("data-sl-home-shortcut-card", "true");
        const icon = document.createElement("span");
        icon.className = "sl-home-runtime-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = svg;
        link.appendChild(icon);
      }
    }
  }

  function historyCards() {
    return [...document.querySelectorAll('article[data-escala-historico="true"]')].filter((node) => node instanceof HTMLElement);
  }

  function parseCardDate(card) {
    const body = text(card);
    const months = { janeiro:"01", fevereiro:"02", marco:"03", abril:"04", maio:"05", junho:"06", julho:"07", agosto:"08", setembro:"09", outubro:"10", novembro:"11", dezembro:"12" };
    const clean = normalize(body);
    const match = clean.match(/(?:domingo|segunda-feira|terca-feira|quarta-feira|quinta-feira|sexta-feira|sabado)?\s*,?\s*(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
    if (!match) return "";
    const month = months[match[2]];
    if (!month) return "";
    return `${match[3]}-${month}-${String(match[1]).padStart(2,"0")}`;
  }

  function applyHistoryFilter() {
    const tools = document.querySelector(".sl-scale-history-tools");
    if (!tools) return;
    const cards = historyCards();
    const date = String(tools.querySelector('[data-sl-history-date]')?.value || "");
    const liturgical = normalize(tools.querySelector('[data-sl-history-liturgical]')?.value || "");
    const filtering = Boolean(date || liturgical);
    let visible = 0;

    cards.forEach((card, index) => {
      const dateMatches = !date || parseCardDate(card) === date;
      const textMatches = !liturgical || normalize(text(card)).includes(liturgical);
      const show = filtering ? dateMatches && textMatches : index === 0;
      card.setAttribute("data-sl-history-hidden", show ? "false" : "true");
      if (show) visible += 1;
    });

    const summary = tools.querySelector(".sl-scale-history-summary");
    if (summary) {
      summary.textContent = filtering
        ? `${visible} escala${visible === 1 ? "" : "s"} encontrada${visible === 1 ? "" : "s"}.`
        : cards.length > 1
          ? `Mostrando a escala mais recente. Use data ou tempo litúrgico para localizar as ${cards.length - 1} anteriores.`
          : "Mostrando a escala mais recente do histórico.";
    }
  }

  function ensureScaleHistorySearch() {
    if (location.pathname !== "/escala") return;
    const historicalTab = [...document.querySelectorAll('[role="tab"]')].find((node) => /Histórico/i.test(text(node)));
    if (!historicalTab || historicalTab.getAttribute("aria-selected") !== "true") {
      document.querySelector(".sl-scale-history-tools")?.remove();
      historyCards().forEach((card) => card.removeAttribute("data-sl-history-hidden"));
      return;
    }

    const cards = historyCards();
    if (!cards.length) return;
    const list = cards[0].parentElement;
    if (!list) return;
    let tools = document.querySelector(".sl-scale-history-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "sl-scale-history-tools";
      tools.setAttribute("data-scale-history-search", "true");
      tools.innerHTML = `
        <div class="sl-scale-history-field"><label for="sl-history-date">Data</label><input id="sl-history-date" data-sl-history-date type="date" /></div>
        <div class="sl-scale-history-field"><label for="sl-history-liturgical">Tempo litúrgico</label><input id="sl-history-liturgical" data-sl-history-liturgical type="search" placeholder="Ex.: Tempo Comum, Advento" autocomplete="off" /></div>
        <button type="button" class="sl-scale-history-clear">Limpar pesquisa</button>
        <p class="sl-scale-history-summary"></p>`;
      list.parentElement?.insertBefore(tools, list);
      tools.querySelector('[data-sl-history-date]')?.addEventListener("input", applyHistoryFilter);
      tools.querySelector('[data-sl-history-liturgical]')?.addEventListener("input", applyHistoryFilter);
      tools.querySelector(".sl-scale-history-clear")?.addEventListener("click", () => {
        const date = tools.querySelector('[data-sl-history-date]');
        const liturgical = tools.querySelector('[data-sl-history-liturgical]');
        if (date) date.value = "";
        if (liturgical) liturgical.value = "";
        applyHistoryFilter();
      });
    }
    applyHistoryFilter();
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
      const response = await fetch(`/api/ranking?motionBeta=${Date.now()}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) return null;
      return await response.json().catch(() => null);
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function viewerId(data) { return String(data?.eu?.id || data?.usuario?.id || data?.usuarioId || "").trim(); }
  function latestConfirmed(data) {
    const list = Array.isArray(data?.ocorrencias) ? data.ocorrencias : [];
    return list.filter((item) => item && item.status === "confirmado" && item.id).sort((a, b) => Number(b.criado_em || 0) - Number(a.criado_em || 0))[0] || null;
  }
  function seenKey(userId, occurrenceId) { return `${DELAY_SEEN_PREFIX}${userId}:${occurrenceId}`; }
  function formatDate(value) {
    const raw = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }

  function renderDelayBanner(userId, occurrence) {
    if (document.querySelector(".sl-motion-beta-delay")) return;
    const key = seenKey(userId, String(occurrence.id));
    try { if (localStorage.getItem(key) === "1") return; } catch {}

    const banner = document.createElement("aside");
    banner.className = "sl-motion-beta-delay";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    const name = String(occurrence.usuario_nome || "Um membro");
    const date = formatDate(occurrence.data_missa);
    banner.innerHTML = `<div class="sl-motion-beta-delay-row"><span class="sl-motion-beta-delay-icon" aria-hidden="true">⏰</span><div class="sl-motion-beta-delay-copy"><strong>Registro de pontualidade confirmado</strong><p>${name.replace(/[<>&]/g, "")} teve um atraso confirmado${date ? ` na celebração de ${date}` : ""}.</p></div><button type="button" class="sl-motion-beta-delay-close" aria-label="Fechar aviso">×</button></div>`;

    const host = document.querySelector("main")?.parentElement || document.body;
    host.insertBefore(banner, host.firstChild);
    banner.querySelector("button")?.addEventListener("click", () => banner.remove());
    setTimeout(() => { if (banner.isConnected) try { localStorage.setItem(key, "1"); } catch {} }, 1200);

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
    } finally { delayBusy = false; }
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
    ensureFourthHomeCard();
    ensureHomeShortcutIcons();
    ensureScaleHistorySearch();
    trimFormationHistory();
    removeLegacyDelayBanner();
    void refreshDelayBanner(false);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
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
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { schedule(); warmOriginalInterface(); void refreshDelayBanner(true); } });
  setInterval(() => { schedule(); if (navigator.onLine) void refreshDelayBanner(false); }, DELAY_REFRESH_MS);
})();
