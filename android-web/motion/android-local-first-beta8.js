"use strict";

(() => {
  const VERSION = "2.0.0-beta.8";
  const ROOT_FLAG = "motionLocalFirstAndroid";
  const DB_NAME = "santa-luzia-motion-local-first-v1";
  const DB_VERSION = 1;
  const QUEUE_STORE = "mutations";
  const META_STORE = "meta";
  const CACHE_PREFIXES = ["santa-luzia-offline-v", "santa-luzia-private-v"];
  const LOCAL_READY_KEY = "santa-luzia:motion-beta8:local-ready";
  const MAX_WARM_LINKS = 48;

  if (document.documentElement.dataset[ROOT_FLAG] === VERSION) return;
  document.documentElement.dataset[ROOT_FLAG] = VERSION;

  const previousFetch = window.fetch.bind(window);
  const initialNavigatorOnline = navigator.onLine !== false;
  let physicalOnline = initialNavigatorOnline;
  let replayPromise = null;
  let warmLinksPromise = null;

  function sameOrigin(value) {
    try { return new URL(value, location.href).origin === location.origin; } catch { return false; }
  }

  function normalizedUrl(value) {
    const url = new URL(value, location.href);
    for (const key of ["_rsc", "motionBeta", "sync"]) url.searchParams.delete(key);
    url.hash = "";
    return url.toString();
  }

  function offlineNow() {
    return !physicalOnline || document.documentElement.dataset.syncState === "offline";
  }

  function randomId(prefix = "offline") {
    try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB indisponível"));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Falha ao abrir IndexedDB"));
    });
  }

  async function idbRun(storeName, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try { result = fn(store); } catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("Falha no armazenamento local")); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error("Operação local cancelada")); };
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Falha na leitura local"));
    });
  }

  async function queuePut(item) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, "readwrite");
        tx.objectStore(QUEUE_STORE).put(item);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Falha ao salvar operação pendente"));
      });
    } finally { db.close(); }
  }

  async function queueDelete(id) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, "readwrite");
        tx.objectStore(QUEUE_STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Falha ao remover operação pendente"));
      });
    } finally { db.close(); }
  }

  async function queueAll() {
    const db = await openDb();
    try {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const result = await requestResult(tx.objectStore(QUEUE_STORE).getAll());
      return Array.isArray(result) ? result.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)) : [];
    } finally { db.close(); }
  }

  async function metaGet(key, fallback = null) {
    const db = await openDb();
    try {
      const tx = db.transaction(META_STORE, "readonly");
      const row = await requestResult(tx.objectStore(META_STORE).get(key));
      return row?.value ?? fallback;
    } finally { db.close(); }
  }

  async function metaPut(key, value) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readwrite");
        tx.objectStore(META_STORE).put({ key, value, updatedAt: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Falha ao salvar metadado local"));
      });
    } finally { db.close(); }
  }

  async function cacheNames() {
    if (!("caches" in window)) return [];
    const names = await caches.keys().catch(() => []);
    const selected = names.filter((name) => CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)));
    if (!selected.some((name) => name.startsWith(CACHE_PREFIXES[0]))) selected.push("santa-luzia-offline-v22");
    if (!selected.some((name) => name.startsWith(CACHE_PREFIXES[1]))) selected.push("santa-luzia-private-v3");
    return [...new Set(selected)];
  }

  function getRequest(value) {
    return new Request(normalizedUrl(value), { method: "GET", credentials: "same-origin" });
  }

  async function cacheMatch(value) {
    if (!("caches" in window)) return null;
    const key = getRequest(value);
    const names = await cacheNames();
    for (const name of names.sort((a, b) => Number(b.includes("private")) - Number(a.includes("private")))) {
      try {
        const hit = await (await caches.open(name)).match(key);
        if (hit) return hit;
      } catch {}
    }
    return null;
  }

  async function cachePut(value, response, privateOnly = false) {
    if (!("caches" in window) || !response?.ok) return;
    const key = getRequest(value);
    const names = await cacheNames();
    await Promise.all(names.filter((name) => !privateOnly || name.includes("private")).map(async (name) => {
      try { await (await caches.open(name)).put(key, response.clone()); } catch {}
    }));
  }

  async function readCachedJson(value) {
    const hit = await cacheMatch(value);
    if (!hit) return null;
    try { return await hit.clone().json(); } catch { return null; }
  }

  async function writeCachedJson(value, data, privateOnly = false) {
    await cachePut(value, jsonResponse(data), privateOnly);
  }

  async function updateCachedJson(value, updater, privateOnly = false) {
    const current = await readCachedJson(value);
    if (!current) return;
    let next;
    try { next = updater(structuredClone(current)); } catch { next = updater(JSON.parse(JSON.stringify(current))); }
    if (next) await writeCachedJson(value, next, privateOnly);
  }

  async function persistSuccessfulGet(url, response) {
    if (!response?.ok || !sameOrigin(url)) return;
    const parsed = new URL(url, location.href);
    const isPrivate = parsed.pathname.startsWith("/api/") && !["/api/escalas", "/api/biblioteca"].includes(parsed.pathname) && !parsed.pathname.startsWith("/api/liturgia");
    await cachePut(parsed.toString(), response, isPrivate);
  }

  async function serializeBody(input, init, request) {
    const explicit = init && Object.prototype.hasOwnProperty.call(init, "body") ? init.body : undefined;
    let body = explicit;
    const contentType = String(new Headers(init?.headers || request?.headers || {}).get("content-type") || "").toLowerCase();

    if (body === undefined && request) {
      try {
        if (contentType.includes("multipart/form-data")) body = await request.clone().formData();
        else if (contentType.includes("application/x-www-form-urlencoded")) body = new URLSearchParams(await request.clone().text());
        else body = await request.clone().text();
      } catch { body = null; }
    }
    if (body == null) return { kind: "none" };
    if (body instanceof FormData) {
      const entries = [];
      for (const [name, value] of body.entries()) {
        if (value instanceof Blob) entries.push({ name, kind: "blob", blob: value, filename: value instanceof File ? value.name : "arquivo", type: value.type || "application/octet-stream" });
        else entries.push({ name, kind: "text", value: String(value) });
      }
      return { kind: "form-data", entries };
    }
    if (body instanceof URLSearchParams) return { kind: "url-search", value: body.toString() };
    if (body instanceof Blob) return { kind: "blob", blob: body, type: body.type || contentType || "application/octet-stream" };
    if (body instanceof ArrayBuffer) return { kind: "array-buffer", buffer: body };
    if (ArrayBuffer.isView(body)) return { kind: "array-buffer", buffer: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
    return { kind: "text", value: String(body) };
  }

  function deserializeBody(descriptor) {
    if (!descriptor || descriptor.kind === "none") return undefined;
    if (descriptor.kind === "text") return descriptor.value;
    if (descriptor.kind === "url-search") return new URLSearchParams(descriptor.value || "");
    if (descriptor.kind === "blob") return descriptor.blob;
    if (descriptor.kind === "array-buffer") return descriptor.buffer;
    if (descriptor.kind === "form-data") {
      const form = new FormData();
      for (const entry of descriptor.entries || []) {
        if (entry.kind === "blob") form.append(entry.name, entry.blob, entry.filename || "arquivo");
        else form.append(entry.name, entry.value ?? "");
      }
      return form;
    }
    return undefined;
  }

  function jsonPayload(descriptor) {
    if (!descriptor) return null;
    if (descriptor.kind === "text") {
      try { return JSON.parse(descriptor.value); } catch { return null; }
    }
    if (descriptor.kind === "form-data") {
      const data = {};
      for (const entry of descriptor.entries || []) if (entry.kind === "text") data[entry.name] = entry.value;
      return data;
    }
    return null;
  }

  function safeHeaders(input, init, request) {
    const headers = new Headers(init?.headers || request?.headers || {});
    for (const name of ["content-length", "host", "cookie"]) headers.delete(name);
    if (input instanceof Request && !init?.headers) for (const [name, value] of input.headers.entries()) headers.set(name, value);
    return [...headers.entries()];
  }

  function queueForbidden(pathname) {
    return pathname.startsWith("/api/auth/") || pathname.startsWith("/api/app/") || pathname.includes("excluir-conta") || pathname.includes("delete-account") || pathname.includes("senha") || pathname.includes("password");
  }

  function queueEligible(pathname, method) {
    return pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method) && !queueForbidden(pathname);
  }

  function scaleFromPayload(payload, id) {
    return {
      id,
      data: payload?.data || "",
      horario: payload?.horario || "",
      celebrante: payload?.celebrante || "",
      observacoes: payload?.observacoes || "",
      pessoas: Array.isArray(payload?.pessoas) ? payload.pessoas : [],
      celebracao_liturgica: payload?.celebracaoLiturgica || null,
      tempo_liturgico: payload?.tempoLiturgico || null,
      cor_liturgica: payload?.corLiturgica || null,
      ciclo_dominical: payload?.cicloDominical || null,
      data_liturgica: payload?.dataLiturgica || null,
      minha_justificativa: null,
      offline_pendente: true,
    };
  }

  function formationFromPayload(payload, id, body) {
    const fileEntry = body?.kind === "form-data" ? (body.entries || []).find((entry) => entry.name === "arquivo" && entry.kind === "blob") : null;
    return {
      id,
      titulo: payload?.titulo || "Formação pendente",
      tema: payload?.tema || "",
      data: payload?.data || "",
      horario: payload?.horario || null,
      descricao: payload?.descricao || "",
      status: payload?.status || "agendada",
      motivo_cancelamento: payload?.motivo_cancelamento || null,
      arquivo: fileEntry ? { nome_original: fileEntry.filename || "arquivo", tamanho: Number(fileEntry.blob?.size || 0), mime: fileEntry.type || fileEntry.blob?.type || "application/octet-stream", local: true } : null,
      minha_presenca: null,
      offline_pendente: true,
    };
  }

  function mergeScaleFields(row, payload) {
    const map = { celebracaoLiturgica: "celebracao_liturgica", tempoLiturgico: "tempo_liturgico", corLiturgica: "cor_liturgica", cicloDominical: "ciclo_dominical", dataLiturgica: "data_liturgica" };
    const next = { ...row, offline_pendente: true };
    for (const [key, value] of Object.entries(payload || {})) next[map[key] || key] = value;
    return next;
  }

  async function optimisticMutation(item) {
    const url = new URL(item.url, location.href);
    const path = url.pathname;
    const payload = jsonPayload(item.body) || {};

    if (path === "/api/escalas" && item.method === "POST") {
      await updateCachedJson("/api/escalas", (data) => ({ ...data, ok: true, escalas: [scaleFromPayload(payload, item.localId), ...(data.escalas || [])] }));
      return;
    }
    const scaleMatch = path.match(/^\/api\/escalas\/([^/]+)$/);
    if (scaleMatch && item.method === "PATCH") {
      const id = decodeURIComponent(scaleMatch[1]);
      await updateCachedJson("/api/escalas", (data) => ({ ...data, escalas: (data.escalas || []).map((row) => String(row.id) === id ? mergeScaleFields(row, payload) : row) }));
      return;
    }
    if (scaleMatch && item.method === "DELETE") {
      const id = decodeURIComponent(scaleMatch[1]);
      await updateCachedJson("/api/escalas", (data) => ({ ...data, escalas: (data.escalas || []).filter((row) => String(row.id) !== id) }));
      return;
    }
    const justificationMatch = path.match(/^\/api\/escalas\/([^/]+)\/minha-justificativa$/);
    if (justificationMatch) {
      const id = decodeURIComponent(justificationMatch[1]);
      await updateCachedJson("/api/escalas", (data) => ({ ...data, escalas: (data.escalas || []).map((row) => String(row.id) === id ? { ...row, minha_justificativa: { ...payload, offline_pendente: true } } : row) }));
      return;
    }

    if (path === "/api/formacoes" && item.method === "POST") {
      await updateCachedJson("/api/formacoes", (data) => ({ ...data, formacoes: [formationFromPayload(payload, item.localId, item.body), ...(data.formacoes || [])] }), true);
      return;
    }
    const formationMatch = path.match(/^\/api\/formacoes\/([^/]+)$/);
    if (formationMatch && item.method === "PATCH") {
      const id = decodeURIComponent(formationMatch[1]);
      await updateCachedJson("/api/formacoes", (data) => ({ ...data, formacoes: (data.formacoes || []).map((row) => String(row.id) === id ? { ...row, ...payload, offline_pendente: true } : row) }), true);
      return;
    }
    if (formationMatch && item.method === "DELETE") {
      const id = decodeURIComponent(formationMatch[1]);
      await updateCachedJson("/api/formacoes", (data) => ({ ...data, formacoes: (data.formacoes || []).filter((row) => String(row.id) !== id) }), true);
      return;
    }
    const presenceMatch = path.match(/^\/api\/formacoes\/([^/]+)\/presencas$/);
    if (presenceMatch && item.method === "PUT" && Array.isArray(payload.presencas)) {
      const id = decodeURIComponent(presenceMatch[1]);
      await updateCachedJson(`/api/formacoes/${encodeURIComponent(id)}/presencas`, (data) => ({
        ...data,
        participantes: (data.participantes || []).map((person) => {
          const change = payload.presencas.find((row) => String(row.usuarioId) === String(person.id));
          return change ? { ...person, situacao: change.situacao, justificativa: change.justificativa || "", offline_pendente: true } : person;
        }),
      }), true);
      return;
    }
    const myPresenceMatch = path.match(/^\/api\/formacoes\/([^/]+)\/minha-presenca$/);
    if (myPresenceMatch) {
      const id = decodeURIComponent(myPresenceMatch[1]);
      await updateCachedJson("/api/formacoes", (data) => ({ ...data, formacoes: (data.formacoes || []).map((row) => String(row.id) === id ? { ...row, minha_presenca: { status: payload.status || "presente", justificativa: payload.justificativa || "", atualizado_em: Date.now(), offline_pendente: true } } : row) }), true);
      return;
    }

    if (path === "/api/perfil" && item.method === "PATCH") {
      await updateCachedJson("/api/perfil", (data) => ({ ...data, perfil: { ...(data.perfil || {}), nome: payload.nome ?? data.perfil?.nome, data_nascimento: payload.dataNascimento ?? data.perfil?.data_nascimento, data_votos: payload.dataVotos ?? data.perfil?.data_votos, foto: payload.foto ?? data.perfil?.foto, bio: payload.bio ?? data.perfil?.bio, offline_pendente: true } }), true);
      const updated = await readCachedJson("/api/perfil");
      if (updated?.perfil) {
        try { localStorage.setItem("santa-luzia:offline:v1:meu-perfil", JSON.stringify({ atualizadoEm: Date.now(), dados: updated })); } catch {}
      }
      return;
    }

    if (path === "/api/notificacoes" && item.method === "POST") {
      await updateCachedJson("/api/notificacoes", (data) => {
        const targetId = String(payload.id || payload.notificacaoId || "");
        if (!targetId) return data;
        const listKey = Array.isArray(data.notificacoes) ? "notificacoes" : Array.isArray(data.itens) ? "itens" : null;
        if (!listKey) return data;
        return { ...data, [listKey]: data[listKey].map((row) => String(row.id) === targetId ? { ...row, lida: true, offline_pendente: true } : row) };
      }, true);
    }
  }

  async function createQueuedMutation(input, init, request, url, method) {
    const parsed = new URL(url, location.href);
    const id = randomId("request");
    const localId = (method === "POST" && (parsed.pathname === "/api/escalas" || parsed.pathname === "/api/formacoes")) ? randomId("local") : null;
    const item = {
      id,
      localId,
      url: `${parsed.pathname}${parsed.search}`,
      method,
      headers: safeHeaders(input, init, request),
      body: await serializeBody(input, init, request),
      createdAt: Date.now(),
      attempts: 0,
      state: "pending",
    };
    await queuePut(item);
    await optimisticMutation(item).catch(() => {});
    document.documentElement.dataset.localPending = "true";
    window.dispatchEvent(new CustomEvent("santa-luzia:local-mutation", { detail: { id, url: item.url, method, pending: true } }));
    return item;
  }

  function syntheticQueuedResponse(item) {
    const payload = { ok: true, offline: true, pendente: true, queued: true, clientRequestId: item.id };
    if (item.localId) {
      payload.id = item.localId;
      if (item.url === "/api/escalas") payload.escala = scaleFromPayload(jsonPayload(item.body) || {}, item.localId);
      if (item.url === "/api/formacoes") payload.formacao = formationFromPayload(jsonPayload(item.body) || {}, item.localId, item.body);
    }
    return jsonResponse(payload, item.method === "POST" ? 201 : 200);
  }

  async function localPendingDownload(pathname) {
    const match = pathname.match(/^\/api\/formacoes\/(local-[^/]+)\/download$/);
    if (!match) return null;
    const id = match[1];
    const rows = await queueAll().catch(() => []);
    const item = rows.find((row) => row.localId === id && row.url === "/api/formacoes" && row.body?.kind === "form-data");
    const entry = item?.body?.entries?.find((row) => row.name === "arquivo" && row.kind === "blob");
    if (!entry?.blob) return null;
    return new Response(entry.blob, { status: 200, headers: { "Content-Type": entry.type || entry.blob.type || "application/octet-stream", "Content-Disposition": `attachment; filename="${String(entry.filename || "arquivo").replace(/[\"\r\n]/g, "-")}"` } });
  }

  async function localIdMap() {
    return (await metaGet("local-id-map", {})) || {};
  }

  async function rememberLocalId(localId, serverId) {
    if (!localId || !serverId) return;
    const map = await localIdMap();
    map[localId] = String(serverId);
    await metaPut("local-id-map", map);
  }

  function rewriteLocalIds(value, map) {
    let out = String(value);
    for (const [localId, serverId] of Object.entries(map || {})) out = out.split(localId).join(String(serverId));
    return out;
  }

  async function replaceOptimisticId(item, responseJson) {
    if (!item.localId) return;
    const serverRow = item.url === "/api/escalas" ? responseJson?.escala : item.url === "/api/formacoes" ? responseJson?.formacao : null;
    const serverId = serverRow?.id || responseJson?.id;
    if (!serverId) return;
    await rememberLocalId(item.localId, serverId);
    const endpoint = item.url === "/api/escalas" ? "/api/escalas" : "/api/formacoes";
    const key = item.url === "/api/escalas" ? "escalas" : "formacoes";
    await updateCachedJson(endpoint, (data) => ({ ...data, [key]: (data[key] || []).map((row) => String(row.id) === item.localId ? { ...row, ...(serverRow || {}), id: String(serverId), offline_pendente: false } : row) }), endpoint === "/api/formacoes");
  }

  async function replayQueue() {
    if (offlineNow()) return;
    if (replayPromise) return replayPromise;
    replayPromise = (async () => {
      const rows = await queueAll().catch(() => []);
      const map = await localIdMap().catch(() => ({}));
      let changed = false;
      for (const item of rows) {
        if (offlineNow()) break;
        if (item.state === "blocked") continue;
        const url = rewriteLocalIds(item.url, map);
        const headers = new Headers(item.headers || []);
        headers.set("X-Santa-Luzia-Offline-Request", item.id);
        let response;
        try {
          response = await previousFetch(url, { method: item.method, headers, body: deserializeBody(item.body), credentials: "same-origin" });
        } catch {
          item.attempts = Number(item.attempts || 0) + 1;
          item.lastAttemptAt = Date.now();
          await queuePut(item).catch(() => {});
          break;
        }
        if (response.ok || response.status === 409) {
          let json = null;
          try { json = await response.clone().json(); } catch {}
          await replaceOptimisticId(item, json).catch(() => {});
          if (item.localId && json) {
            const serverRow = item.url === "/api/escalas" ? json.escala : item.url === "/api/formacoes" ? json.formacao : null;
            if (serverRow?.id) map[item.localId] = String(serverRow.id);
          }
          await queueDelete(item.id).catch(() => {});
          changed = true;
          continue;
        }
        if ([400, 401, 403, 404, 422].includes(response.status)) {
          let errorText = `Servidor recusou a operação (${response.status}).`;
          try { const data = await response.clone().json(); errorText = data?.erro || errorText; } catch {}
          item.state = "blocked";
          item.serverError = errorText;
          item.lastAttemptAt = Date.now();
          await queuePut(item).catch(() => {});
          window.dispatchEvent(new CustomEvent("santa-luzia:local-mutation-error", { detail: { id: item.id, url: item.url, error: errorText } }));
          continue;
        }
        item.attempts = Number(item.attempts || 0) + 1;
        item.lastAttemptAt = Date.now();
        await queuePut(item).catch(() => {});
        if (response.status >= 500 || response.status === 429) break;
      }
      const remaining = await queueAll().catch(() => []);
      document.documentElement.dataset.localPending = remaining.some((row) => row.state !== "blocked") ? "true" : "false";
      document.documentElement.dataset.localBlocked = remaining.some((row) => row.state === "blocked") ? "true" : "false";
      if (changed) {
        window.dispatchEvent(new Event("santa-luzia:server-sync"));
        window.dispatchEvent(new CustomEvent("santa-luzia:offline-snapshot-sync"));
      }
    })().finally(() => { replayPromise = null; });
    return replayPromise;
  }

  async function warmAnchor(url) {
    if (offlineNow() || !sameOrigin(url)) return false;
    const parsed = new URL(url, location.href);
    if (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/_next/") || parsed.pathname.includes("logout") || parsed.pathname.includes("sair")) return false;
    try {
      const response = await previousFetch(`${parsed.pathname}${parsed.search}`, { cache: "no-store", credentials: "same-origin", headers: { Accept: "text/html", "X-Santa-Luzia-Motion-Beta": "1" } });
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !type.includes("text/html")) return false;
      await cachePut(parsed.toString(), response, parsed.pathname.startsWith("/area-restrita/") || parsed.pathname === "/formacao");
      return true;
    } catch { return false; }
  }

  async function warmDiscoveredLinks() {
    if (offlineNow() || warmLinksPromise) return warmLinksPromise;
    warmLinksPromise = (async () => {
      const urls = [];
      const seen = new Set();
      for (const anchor of document.querySelectorAll("a[href]")) {
        try {
          const url = new URL(anchor.href, location.href);
          const key = `${url.pathname}${url.search}`;
          if (url.origin !== location.origin || seen.has(key) || url.pathname.startsWith("/api/")) continue;
          seen.add(key); urls.push(url);
          if (urls.length >= MAX_WARM_LINKS) break;
        } catch {}
      }
      for (const url of urls) await warmAnchor(url);
      try { localStorage.setItem(LOCAL_READY_KEY, JSON.stringify({ version: VERSION, at: Date.now(), routes: urls.length })); } catch {}
    })().finally(() => { warmLinksPromise = null; });
    return warmLinksPromise;
  }

  async function physicalStatusFromCapacitor() {
    try {
      const network = window.Capacitor?.Plugins?.Network;
      if (!network?.getStatus) return;
      const status = await network.getStatus();
      if (typeof status?.connected === "boolean") physicalOnline = status.connected;
      if (network.addListener && !window.__santaLuziaBeta8NetworkListener) {
        window.__santaLuziaBeta8NetworkListener = true;
        await network.addListener("networkStatusChange", (state) => {
          if (typeof state?.connected === "boolean") physicalOnline = state.connected;
          if (physicalOnline) { void replayQueue(); void warmDiscoveredLinks(); }
        });
      }
    } catch {}
  }

  // O aplicativo é local-first: componentes antigos que usam navigator.onLine
  // apenas para bloquear botões devem continuar executando e deixar esta camada
  // decidir se envia agora ou enfileira. A conectividade física fica separada.
  try {
    const proto = Object.getPrototypeOf(navigator);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "onLine");
    if (!descriptor || descriptor.configurable !== false) Object.defineProperty(proto, "onLine", { configurable: true, enumerable: true, get: () => true });
    else Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  } catch {}

  window.fetch = async function motionLocalFirstFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    if (!sameOrigin(url)) return previousFetch(input, init);
    const parsed = new URL(url, location.href);

    if (method === "GET") {
      if (offlineNow()) {
        const pendingDownload = await localPendingDownload(parsed.pathname).catch(() => null);
        if (pendingDownload) return pendingDownload;
        const cached = await cacheMatch(url);
        if (cached) return cached;
      }
      try {
        const response = await previousFetch(input, init);
        if (response.ok) void persistSuccessfulGet(url, response.clone());
        return response;
      } catch (error) {
        const cached = await cacheMatch(url);
        if (cached) return cached;
        throw error;
      }
    }

    if (!queueEligible(parsed.pathname, method)) return previousFetch(input, init);

    if (offlineNow()) {
      const item = await createQueuedMutation(input, init, request, url, method);
      return syntheticQueuedResponse(item);
    }

    try {
      const response = await previousFetch(input, init);
      if (response.status < 500 && response.status !== 429) return response;
      const item = await createQueuedMutation(input, init, request, url, method);
      return syntheticQueuedResponse(item);
    } catch {
      const item = await createQueuedMutation(input, init, request, url, method);
      return syntheticQueuedResponse(item);
    }
  };

  window.addEventListener("offline", () => { physicalOnline = false; });
  window.addEventListener("online", () => { physicalOnline = true; void physicalStatusFromCapacitor(); void replayQueue(); void warmDiscoveredLinks(); });
  window.addEventListener("focus", () => { void physicalStatusFromCapacitor().then(() => { if (!offlineNow()) void replayQueue(); }); });
  window.addEventListener("santa-luzia:server-sync", () => { if (!offlineNow()) { void replayQueue(); void warmDiscoveredLinks(); } });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void physicalStatusFromCapacitor().then(() => { if (!offlineNow()) { void replayQueue(); void warmDiscoveredLinks(); } });
  });

  const observer = new MutationObserver(() => { if (!offlineNow()) void warmDiscoveredLinks(); });
  try { observer.observe(document.documentElement, { childList: true, subtree: true }); } catch {}

  void physicalStatusFromCapacitor().then(() => {
    if (!offlineNow()) { void replayQueue(); void warmDiscoveredLinks(); }
  });
  setTimeout(() => { if (!offlineNow()) { void replayQueue(); void warmDiscoveredLinks(); } }, 1200);
  setTimeout(() => { if (!offlineNow()) void warmDiscoveredLinks(); }, 6000);
})();
