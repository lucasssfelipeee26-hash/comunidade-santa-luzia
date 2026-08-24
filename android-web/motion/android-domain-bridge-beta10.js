"use strict";

(() => {
  const VERSION = "2.0.0-beta.10";
  const FLAG = "motionDomainBridgeBeta10";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const previousFetch = window.fetch.bind(window);
  let physicalOnline = true;

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  function pathOf(url) { try { return new URL(url, location.href).pathname; } catch { return ""; } }
  function requestBody(input, init, request) {
    if (typeof init?.body === "string") { try { return JSON.parse(init.body); } catch { return null; } }
    return request?.clone().json().catch(() => null) || Promise.resolve(null);
  }
  async function updatePhysical() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (network?.getStatus) physicalOnline = !!(await network.getStatus())?.connected;
    } catch { physicalOnline = false; }
    return physicalOnline;
  }

  async function cacheNames() {
    if (!("caches" in window)) return [];
    const names = await caches.keys().catch(() => []);
    return names.filter((name) => name.startsWith("santa-luzia-offline-v") || name.startsWith("santa-luzia-private-v"));
  }
  function keyFor(path) { return new Request(new URL(path, location.href).toString(), { method: "GET", credentials: "same-origin" }); }
  async function readCached(path) {
    if (!("caches" in window)) return null;
    const key = keyFor(path);
    for (const name of await cacheNames()) {
      try {
        const response = await (await caches.open(name)).match(key);
        if (response) return await response.clone().json();
      } catch {}
    }
    return null;
  }
  async function writeCached(path, data) {
    if (!("caches" in window)) return;
    const key = keyFor(path);
    const response = jsonResponse(data);
    const names = await cacheNames();
    await Promise.all(names.map(async (name) => { try { await (await caches.open(name)).put(key, response.clone()); } catch {} }));
  }
  async function updateCached(path, updater) {
    const current = await readCached(path);
    if (!current) return null;
    const next = updater(JSON.parse(JSON.stringify(current)));
    if (next) await writeCached(path, next);
    return next;
  }

  function localRankingEnvelope() {
    try {
      const value = JSON.parse(localStorage.getItem("santa-luzia:offline:v1:ranking") || "null");
      return value?.dados?.eu && Array.isArray(value?.dados?.ranking) ? value : null;
    } catch { return null; }
  }
  function saveLocalRanking(data) {
    try { localStorage.setItem("santa-luzia:offline:v1:ranking", JSON.stringify({ atualizadoEm: Date.now(), dados: data })); } catch {}
  }
  function validRanking(data) {
    return !!data?.eu?.id && Array.isArray(data?.ranking) && Array.isArray(data?.membros) && Array.isArray(data?.ocorrencias);
  }
  async function safeRankingResponse(response) {
    if (!response?.ok) return response;
    const data = await response.clone().json().catch(() => null);
    if (validRanking(data)) { saveLocalRanking(data); return response; }
    const cache = await readCached("/api/ranking");
    if (validRanking(cache)) return jsonResponse(cache);
    const local = localRankingEnvelope()?.dados;
    if (validRanking(local)) return jsonResponse(local);
    return jsonResponse({ erro: "Os dados de Atrasos/Jornada ainda não foram sincronizados neste aparelho." }, 503);
  }

  async function optimisticModeration(payload) {
    if (!payload?.ocorrenciaId || !["confirmado", "rejeitado"].includes(payload.status)) return;
    const apply = (data) => {
      if (!validRanking(data)) return data;
      return { ...data, ocorrencias: data.ocorrencias.map((row) => String(row.id) === String(payload.ocorrenciaId) ? { ...row, status: payload.status, offline_pendente: true } : row) };
    };
    const next = await updateCached("/api/ranking", apply);
    const local = localRankingEnvelope()?.dados;
    if (local) saveLocalRanking(apply(local));
    if (next) window.dispatchEvent(new CustomEvent("santa-luzia:offline-data", { detail: { tipo: "ranking" } }));
  }

  async function optimisticTheme(payload) {
    const tema = String(payload?.tema || "");
    if (!tema) return;
    document.documentElement.dataset.siteTheme = tema;
    await writeCached("/api/configuracao/tema", { ok: true, tema, configuracao: { tema }, offline_pendente: true });
  }

  async function optimisticAdminQuiz(payload) {
    if (!payload || typeof payload !== "object") return;
    await updateCached("/api/quizzes?admin=1", (data) => {
      const list = Array.isArray(data?.quizzes) ? data.quizzes : [];
      if (payload.action === "excluir" && payload.id) return { ...data, quizzes: list.filter((q) => String(q.id) !== String(payload.id)) };
      const id = String(payload.id || `local-quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const row = { ...payload, id, offline_pendente: true };
      const exists = list.some((q) => String(q.id) === id);
      return { ...data, quizzes: exists ? list.map((q) => String(q.id) === id ? { ...q, ...row } : q) : [row, ...list] };
    });
  }

  function mergePendingDelays() {
    let pending = [];
    try { pending = JSON.parse(localStorage.getItem("santa-luzia:offline:v1:atrasos-pendentes") || "[]"); } catch {}
    if (!Array.isArray(pending) || !pending.length) return;
    const apply = (data) => {
      if (!validRanking(data)) return data;
      const occurrences = [...data.ocorrencias];
      for (const item of pending) {
        const payload = item?.payload || {};
        if (!payload.usuarioId || occurrences.some((row) => String(row.id) === String(item.id))) continue;
        const target = data.membros.find((m) => String(m.id) === String(payload.usuarioId));
        occurrences.unshift({
          id: String(item.id), usuario_id: String(payload.usuarioId), usuario_nome: target?.nome || "Membro",
          data_missa: String(payload.dataMissa || ""), horario_missa: String(payload.horarioMissa || ""), limite_chegada: String(payload.horarioMissa || ""),
          observacao: payload.observacao || null, status: "pendente", criado_em: Number(item.criadoNoAparelhoEm || Date.now()),
          reportado_por: item.reportadoPor || data.eu.id, reportado_por_nome: data.eu.nome, offline_pendente: true,
        });
      }
      return { ...data, ocorrencias: occurrences };
    };
    void updateCached("/api/ranking", apply);
    const local = localRankingEnvelope()?.dados;
    if (local) saveLocalRanking(apply(local));
  }

  window.fetch = async function motionDomainFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const path = pathOf(url);
    const method = String(init?.method || request?.method || "GET").toUpperCase();

    if (method === "GET" && path === "/api/ranking") return safeRankingResponse(await previousFetch(input, init));
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return previousFetch(input, init);

    const payload = await Promise.resolve(requestBody(input, init, request));
    const online = await updatePhysical();

    // Estes dois fluxos já possuem filas de domínio e mensagens de "pendente".
    // Forçamos o catch deles quando não há rede para impedir falso "enviado".
    if (!online && path === "/api/ranking" && payload?.action === "reportar_atraso") throw new TypeError("Operação guardada no aparelho.");
    if (!online && /^\/api\/formacoes\/[^/]+\/minha-presenca$/.test(path) && method === "PUT") throw new TypeError("Presença guardada no aparelho.");

    const response = await previousFetch(input, init);
    let queued = false;
    if (response?.ok) {
      try { queued = !!(await response.clone().json())?.queued; } catch {}
    }

    if (path === "/api/ranking" && payload?.action === "moderar_atraso" && (queued || response.ok)) await optimisticModeration(payload);
    if (path === "/api/configuracao/tema" && method === "POST" && response.ok) await optimisticTheme(payload);
    if (path === "/api/quizzes" && method === "POST" && response.ok) await optimisticAdminQuiz(payload);
    return response;
  };

  window.addEventListener("santa-luzia:offline-data", (event) => {
    if (event?.detail?.tipo === "atrasos") mergePendingDelays();
  });
  window.addEventListener("online", () => { physicalOnline = true; });
  window.addEventListener("offline", () => { physicalOnline = false; });
  void updatePhysical();
})();
