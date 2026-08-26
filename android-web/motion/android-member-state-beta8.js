"use strict";

(() => {
  const VERSION = "2.0.0-beta.8";
  const FLAG = "motionMemberStateAndroid";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const previousFetch = window.fetch.bind(window);
  const CACHE_PREFIXES = ["santa-luzia-private-v", "santa-luzia-offline-v"];

  function sameOrigin(value) {
    try { return new URL(value, location.href).origin === location.origin; } catch { return false; }
  }

  function normalized(value) {
    const url = new URL(value, location.href);
    for (const key of ["_rsc", "motionBeta", "sync"]) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  }

  async function cacheList() {
    if (!("caches" in window)) return [];
    const names = await caches.keys().catch(() => []);
    const result = names.filter((name) => CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)));
    if (!result.some((name) => name.startsWith("santa-luzia-private-v"))) result.unshift("santa-luzia-private-v3");
    if (!result.some((name) => name.startsWith("santa-luzia-offline-v"))) result.push("santa-luzia-offline-v22");
    return [...new Set(result)];
  }

  function requestFor(value) {
    return new Request(normalized(value), { method: "GET", credentials: "same-origin" });
  }

  async function readJson(value) {
    if (!("caches" in window)) return null;
    const key = requestFor(value);
    for (const name of await cacheList()) {
      try {
        const response = await (await caches.open(name)).match(key);
        if (response) return await response.clone().json();
      } catch {}
    }
    return null;
  }

  async function writeJson(value, data) {
    if (!("caches" in window)) return;
    const response = new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
    const key = requestFor(value);
    for (const name of await cacheList()) {
      try { await (await caches.open(name)).put(key, response.clone()); } catch {}
    }
  }

  async function updateJson(value, mutate) {
    const current = await readJson(value);
    if (!current) return;
    let next;
    try { next = mutate(structuredClone(current)); }
    catch { next = mutate(JSON.parse(JSON.stringify(current))); }
    if (next) await writeJson(value, next);
  }

  function bodyJson(init, request) {
    const body = init?.body;
    if (typeof body === "string") {
      try { return JSON.parse(body); } catch { return null; }
    }
    if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
    if (body instanceof FormData) {
      const out = {};
      for (const [key, value] of body.entries()) if (typeof value === "string") out[key] = value;
      return out;
    }
    if (!body && request) return null;
    return null;
  }

  function pendingRecord(payload, id) {
    return {
      id,
      data: String(payload?.data || ""),
      descricao: String(payload?.descricao || ""),
      criadoEm: Date.now(),
      criado_em: Date.now(),
      offline_pendente: true,
    };
  }

  function updateMemberInList(data, id, updater) {
    if (!Array.isArray(data?.membros)) return data;
    return { ...data, membros: data.membros.map((member) => String(member.id) === id ? updater(member) : member) };
  }

  function updateTeamInList(data, id, updater, remove = false) {
    if (!Array.isArray(data?.equipe)) return data;
    return { ...data, equipe: remove ? data.equipe.filter((member) => String(member.id) !== id) : data.equipe.map((member) => String(member.id) === id ? updater(member) : member) };
  }

  async function optimistic(url, method, payload, responseJson) {
    if (!responseJson?.offline || !responseJson?.pendente) return;
    const path = new URL(url, location.href).pathname;

    const status = path.match(/^\/api\/membros\/([^/]+)\/status$/);
    if (status && method === "PATCH") {
      const id = decodeURIComponent(status[1]);
      const nextStatus = String(payload?.status || "");
      if (!nextStatus) return;
      await Promise.all([
        updateJson("/api/membros", (data) => updateMemberInList(data, id, (member) => ({ ...member, status: nextStatus, offline_pendente: true }))),
        updateJson("/api/equipe", (data) => updateTeamInList(data, id, (member) => ({ ...member, status: nextStatus, offline_pendente: true }))),
        updateJson(`/api/membros/${encodeURIComponent(id)}`, (data) => data?.membro ? ({ ...data, membro: { ...data.membro, status: nextStatus, offline_pendente: true } }) : data),
      ]);
      return;
    }

    const promote = path.match(/^\/api\/membros\/([^/]+)\/promover$/);
    if (promote && method === "PATCH") {
      const id = decodeURIComponent(promote[1]);
      await Promise.all([
        updateJson("/api/membros", (data) => Array.isArray(data?.membros) ? ({ ...data, membros: data.membros.filter((member) => String(member.id) !== id) }) : data),
        updateJson("/api/equipe", (data) => updateTeamInList(data, id, (member) => member, true)),
        updateJson(`/api/membros/${encodeURIComponent(id)}`, (data) => data?.membro ? ({ ...data, membro: { ...data.membro, tipo: "moderador", offline_pendente: true } }) : data),
      ]);
      return;
    }

    const addRecord = path.match(/^\/api\/membros\/([^/]+)\/registros$/);
    if (addRecord && method === "POST") {
      const id = decodeURIComponent(addRecord[1]);
      const type = String(payload?.tipo || "");
      if (!type) return;
      const record = pendingRecord(payload, `local-registro-${responseJson.clientRequestId || Date.now()}`);
      const append = (member) => ({ ...member, [type]: [...(Array.isArray(member?.[type]) ? member[type] : []), record], offline_pendente: true });
      await Promise.all([
        updateJson("/api/membros", (data) => updateMemberInList(data, id, append)),
        updateJson("/api/equipe", (data) => updateTeamInList(data, id, append)),
        updateJson(`/api/membros/${encodeURIComponent(id)}`, (data) => data?.membro ? ({ ...data, membro: append(data.membro) }) : data),
      ]);
      return;
    }

    const removeRecord = path.match(/^\/api\/membros\/([^/]+)\/registros\/([^/]+)$/);
    if (removeRecord && method === "DELETE") {
      const id = decodeURIComponent(removeRecord[1]);
      const recordId = decodeURIComponent(removeRecord[2]);
      const remove = (member) => {
        const next = { ...member, offline_pendente: true };
        for (const type of ["advertencias", "justificativas", "faltas", "observacoes"]) {
          if (Array.isArray(next[type])) next[type] = next[type].filter((row) => String(row.id) !== recordId);
        }
        return next;
      };
      await Promise.all([
        updateJson("/api/membros", (data) => updateMemberInList(data, id, remove)),
        updateJson("/api/equipe", (data) => updateTeamInList(data, id, remove)),
        updateJson(`/api/membros/${encodeURIComponent(id)}`, (data) => data?.membro ? ({ ...data, membro: remove(data.membro) }) : data),
      ]);
    }
  }

  window.fetch = async function motionMemberStateFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const payload = sameOrigin(url) ? bodyJson(init, request) : null;
    const response = await previousFetch(input, init);
    if (!sameOrigin(url) || !["POST", "PATCH", "DELETE"].includes(method)) return response;
    try {
      const json = await response.clone().json();
      await optimistic(url, method, payload, json);
    } catch {}
    return response;
  };
})();
