"use strict";

(() => {
  const VERSION = "2.0.0-beta.11";
  const ROOT_FLAG = "constanciaLuzBeta11";
  const STORAGE_PREFIX = "santa-luzia:constancia-luz:v1";
  const RANKING_KEY = "santa-luzia:offline:v1:ranking";
  const POINTS_PER_DAY = 2;
  const MAX_DAYS = 7;
  const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  let busy = false;
  let lastUserId = "";

  if (document.documentElement.dataset[ROOT_FLAG] === VERSION) return;
  document.documentElement.dataset[ROOT_FLAG] = VERSION;

  const style = document.createElement("style");
  style.id = "sl-constancia-luz-beta11-style";
  style.textContent = `
    #sl-constancia-luz-banner{margin:0 0 12px;border:1px solid rgba(123,19,38,.12);border-radius:20px;background:linear-gradient(105deg,rgba(123,19,38,.055),rgba(216,180,84,.10),rgba(255,255,255,.92));box-shadow:0 8px 24px rgba(79,36,49,.055);padding:11px 12px;color:#3d2730;overflow:hidden;position:relative}
    #sl-constancia-luz-banner::after{content:"✦";position:absolute;right:12px;top:5px;font-size:38px;color:rgba(191,166,106,.16);pointer-events:none}
    .sl-cl-head{display:flex;align-items:center;gap:9px;min-width:0;padding-right:28px}
    .sl-cl-icon{width:34px;height:34px;border-radius:12px;background:#7b1326;color:#fff;display:grid;place-items:center;flex:0 0 auto;box-shadow:0 5px 12px rgba(123,19,38,.16)}
    .sl-cl-copy{min-width:0;flex:1}.sl-cl-kicker{font-size:8px;line-height:1;text-transform:uppercase;letter-spacing:.15em;font-weight:900;color:#7b1326}.sl-cl-title{font-family:Georgia,serif;font-size:15px;line-height:1.25;font-weight:700;color:#4b1e2b;margin-top:3px}.sl-cl-sub{font-size:9px;line-height:1.35;color:#76646b;margin-top:1px}
    .sl-cl-score{font-size:10px;font-weight:900;color:#7b1326;white-space:nowrap;flex:0 0 auto}.sl-cl-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-top:9px}.sl-cl-day{min-width:0;border-radius:10px;border:1px solid rgba(123,19,38,.09);background:rgba(255,255,255,.72);padding:5px 2px;text-align:center}.sl-cl-day b{display:block;font-size:9px;color:#5b3e48}.sl-cl-day span{display:block;margin-top:2px;font-size:8px;color:#8a777d}.sl-cl-day[data-done="true"]{background:rgba(216,180,84,.18);border-color:rgba(191,166,106,.36)}.sl-cl-day[data-done="true"] b{color:#7b1326}.sl-cl-day[data-today="true"]{outline:2px solid rgba(123,19,38,.16);outline-offset:1px}.sl-cl-complete .sl-cl-title{color:#7b1326}.sl-cl-complete{background:linear-gradient(105deg,rgba(216,180,84,.18),rgba(255,250,229,.92),rgba(255,255,255,.95))!important;border-color:rgba(191,166,106,.4)!important}
    @media(max-width:380px){.sl-cl-sub{display:none}.sl-cl-days{gap:3px}.sl-cl-day{padding-left:1px;padding-right:1px}}
  `;
  document.head.appendChild(style);

  function todayCuiaba() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  function shiftDate(iso, days) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function weekInfo(today = todayCuiaba()) {
    const date = new Date(`${today}T12:00:00Z`);
    const offset = (date.getUTCDay() + 6) % 7;
    const monday = shiftDate(today, -offset);
    return { today, monday, sunday: shiftDate(monday, 6), todayIndex: offset, dates: Array.from({ length: MAX_DAYS }, (_, i) => shiftDate(monday, i)) };
  }

  function stateKey(userId, monday) { return `${STORAGE_PREFIX}:${userId}:${monday}`; }
  function readJson(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

  function emptyState(userId, week = weekInfo()) {
    return { userId, monday: week.monday, sunday: week.sunday, days: {}, pending: [], rankingApplied: [], updatedAt: Date.now() };
  }

  function loadState(userId, week = weekInfo()) {
    const saved = readJson(stateKey(userId, week.monday), null);
    return saved && saved.userId === userId ? { ...emptyState(userId, week), ...saved, days: saved.days || {}, pending: Array.isArray(saved.pending) ? saved.pending : [], rankingApplied: Array.isArray(saved.rankingApplied) ? saved.rankingApplied : [] } : emptyState(userId, week);
  }

  function saveState(state) {
    state.updatedAt = Date.now();
    writeJson(stateKey(state.userId, state.monday), state);
  }

  function cachedRanking() {
    const envelope = readJson(RANKING_KEY, null);
    return envelope?.dados?.eu?.id ? envelope : null;
  }

  function resolveCachedUserId() {
    return String(cachedRanking()?.dados?.eu?.id || "");
  }

  function applyLocalRankingPoint(userId, date, state) {
    if (state.rankingApplied.includes(date)) return;
    const envelope = cachedRanking();
    if (!envelope?.dados?.ranking) return;
    let changed = false;
    envelope.dados.ranking = envelope.dados.ranking.map((row) => {
      if (String(row.usuarioId) !== String(userId)) return row;
      changed = true;
      return { ...row, pontos: Number(row.pontos || 0) + POINTS_PER_DAY, ajustes: Number(row.ajustes || 0) + POINTS_PER_DAY };
    });
    if (!changed) return;
    envelope.dados.ranking.sort((a, b) => Number(b.pontos || 0) - Number(a.pontos || 0) || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    envelope.dados.ranking.forEach((row, index) => { row.posicao = index + 1; });
    envelope.atualizadoEm = Date.now();
    if (writeJson(RANKING_KEY, envelope)) {
      state.rankingApplied.push(date);
      saveState(state);
      window.dispatchEvent(new CustomEvent("santa-luzia:offline-data", { detail: { tipo: "ranking", origem: "constancia-luz" } }));
    }
  }

  function markLocalDay(userId, date, { pending = false, applyRanking = false } = {}) {
    const week = weekInfo(date);
    const state = loadState(userId, week);
    state.days[date] = true;
    if (pending && !state.pending.includes(date)) state.pending.push(date);
    if (!pending) state.pending = state.pending.filter((value) => value !== date);
    saveState(state);
    if (applyRanking) applyLocalRankingPoint(userId, date, state);
    return state;
  }

  function mergeServerStatus(userId, status) {
    if (!status?.semanaInicio || !Array.isArray(status.dias)) return loadState(userId);
    const week = { ...weekInfo(), monday: status.semanaInicio, sunday: status.semanaFim };
    const state = loadState(userId, week);
    for (const day of status.dias) if (day?.recebido && day?.data) state.days[String(day.data)] = true;
    state.pending = state.pending.filter((date) => !state.days[date] || !status.dias.some((day) => day.data === date && day.recebido));
    saveState(state);
    return state;
  }

  function localStatus(userId) {
    const week = weekInfo();
    const state = loadState(userId, week);
    const dias = week.dates.map((date, index) => ({ numero: index + 1, data: date, recebido: Boolean(state.days[date]), hoje: date === week.today }));
    const done = dias.filter((day) => day.recebido).length;
    return { titulo: "Constância de Luz", pontosPorDia: POINTS_PER_DAY, maximoSemanal: 14, semanaInicio: week.monday, semanaFim: week.sunday, diaAtual: week.todayIndex + 1, dias, diasConcluidos: done, pontosSemana: done * POINTS_PER_DAY, recebidoHoje: Boolean(state.days[week.today]), concluida: done === MAX_DAYS, pendente: state.pending.length > 0 };
  }

  function bannerAnchor() {
    const main = document.querySelector("main");
    if (!main) return null;
    const heading = [...main.querySelectorAll("h1,h2")].find((el) => String(el.textContent || "").trim() === "Jornada Litúrgica");
    if (!heading) return null;
    return heading.closest("section");
  }

  function renderBanner(status) {
    const anchor = bannerAnchor();
    if (!anchor) return;
    let banner = document.getElementById("sl-constancia-luz-banner");
    if (!banner) {
      banner = document.createElement("section");
      banner.id = "sl-constancia-luz-banner";
      anchor.insertAdjacentElement("afterend", banner);
    }
    banner.classList.toggle("sl-cl-complete", Boolean(status.concluida));
    const title = status.concluida ? "✦ Constância de Luz" : "Presença semanal";
    const subtitle = status.concluida ? "7 de 7 dias concluídos · título conquistado" : `${status.diasConcluidos} de 7 dias · +2 pontos em cada dia acessado`;
    banner.innerHTML = `<div class="sl-cl-head"><div class="sl-cl-icon">✦</div><div class="sl-cl-copy"><div class="sl-cl-kicker">Jornada Litúrgica</div><div class="sl-cl-title">${title}</div><div class="sl-cl-sub">${subtitle}${status.pendente ? " · sincronização pendente" : ""}</div></div><div class="sl-cl-score">${status.pontosSemana}/14 pts</div></div><div class="sl-cl-days">${status.dias.map((day, index) => `<div class="sl-cl-day" data-done="${day.recebido ? "true" : "false"}" data-today="${day.hoje ? "true" : "false"}"><b>${day.recebido ? "✓" : index + 1}</b><span>${WEEK_LABELS[index]}</span></div>`).join("")}</div>`;
  }

  async function resolveUserId() {
    const cached = resolveCachedUserId();
    if (cached) return cached;
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const json = await response.json();
      return String(json?.sessao?.usuario?.id || json?.usuario?.id || "");
    } catch { return ""; }
  }

  async function sendDay(userId, date) {
    try {
      const response = await fetch("/api/constancia-luz", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ data: date }) });
      const json = await response.json().catch(() => ({}));
      if (response.ok) {
        const queued = Boolean(json?.queued || json?.offline || json?.pendente);
        const state = markLocalDay(userId, date, { pending: queued, applyRanking: queued });
        if (json?.constancia) mergeServerStatus(userId, json.constancia);
        return { ok: true, queued, state, server: json?.constancia || null };
      }
      return { ok: false, status: response.status };
    } catch { return { ok: false, status: 0 }; }
  }

  async function syncAndClaim() {
    if (busy) return;
    busy = true;
    try {
      const userId = await resolveUserId();
      if (!userId) return;
      lastUserId = userId;
      const week = weekInfo();
      let status = localStatus(userId);
      renderBanner(status);

      try {
        const response = await fetch("/api/constancia-luz", { cache: "no-store", signal: AbortSignal.timeout(6000) });
        if (response.ok) {
          const json = await response.json();
          if (json?.constancia) { mergeServerStatus(userId, json.constancia); status = localStatus(userId); renderBanner(status); }
        }
      } catch {}

      const state = loadState(userId, week);
      const retryDates = [...new Set([...(state.pending || []), ...(status.recebidoHoje ? [] : [week.today])])].sort();
      for (const date of retryDates) {
        const result = await sendDay(userId, date);
        if (!result.ok) {
          // Backend antigo/sem rede: mantém uma fila local simples. O endpoint é
          // idempotente por usuário+data, então o reenvio futuro nunca duplica pontos.
          markLocalDay(userId, date, { pending: true, applyRanking: date === week.today });
        }
      }
      status = localStatus(userId);
      renderBanner(status);
      window.dispatchEvent(new CustomEvent("santa-luzia:constancia-luz", { detail: status }));
      if (!status.pendente) window.dispatchEvent(new Event("santa-luzia:server-sync"));
    } finally { busy = false; }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled || !lastUserId) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; renderBanner(localStatus(lastUserId)); });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("santa-luzia:local-route", () => setTimeout(() => { if (lastUserId) renderBanner(localStatus(lastUserId)); void syncAndClaim(); }, 0));
  window.addEventListener("online", () => void syncAndClaim());
  window.addEventListener("focus", () => void syncAndClaim());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void syncAndClaim(); });
  setTimeout(() => void syncAndClaim(), 500);
})();
