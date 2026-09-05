"use strict";

(() => {
  const VERSION = "2.0.0-beta.10";
  const FLAG = "motionNativeFetchBeta10";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const browserFetch = window.fetch.bind(window);
  window.__santaLuziaBrowserFetch = browserFetch;

  function plugin() { return window.Capacitor?.Plugins?.SyncHttp || null; }
  function sameOrigin(url) { try { return new URL(url, location.href).origin === location.origin; } catch { return false; } }
  function dataCuiaba() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }
  function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }

  async function localLiturgy(parsed) {
    if (parsed.pathname !== "/api/liturgia-local" && parsed.pathname !== "/api/liturgia") return null;
    const date = parsed.pathname === "/api/liturgia" ? String(parsed.searchParams.get("data") || dataCuiaba()) : dataCuiaba();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ erro: "Data litúrgica inválida." }, 400);
    const [year, month] = date.split("-");
    try {
      const response = await browserFetch(`/offline/liturgia-completa/${year}-${month}.json`, { cache: "force-cache" });
      if (!response.ok) return null;
      const pack = await response.json();
      const day = pack?.dias?.[date];
      if (!day) return null;
      const hasText = Boolean(day?.leituras?.primeiraLeitura?.some?.((item) => item?.texto) && day?.leituras?.evangelho?.some?.((item) => item?.texto));
      return jsonResponse({ ...day, dataIso: date, origem: "apk-local", offline: true, quizDisponivel: hasText, fonte: day.fonte || { nome: "Acervo Litúrgico Santa Luzia" } });
    } catch { return null; }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    return btoa(binary);
  }
  function base64ToBytes(value) {
    const binary = atob(value || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  async function blobBase64(blob) { return bytesToBase64(new Uint8Array(await blob.arrayBuffer())); }

  async function bodyDescriptor(input, init, request) {
    let body = init && Object.prototype.hasOwnProperty.call(init, "body") ? init.body : undefined;
    const headers = new Headers(init?.headers || request?.headers || {});
    const contentType = String(headers.get("content-type") || "");
    if (body === undefined && request && !["GET", "HEAD"].includes(request.method.toUpperCase())) {
      try {
        if (contentType.toLowerCase().includes("multipart/form-data")) body = await request.clone().formData();
        else if (contentType.toLowerCase().includes("application/x-www-form-urlencoded")) body = new URLSearchParams(await request.clone().text());
        else body = await request.clone().blob();
      } catch { body = undefined; }
    }
    if (body == null) return { body: "", contentType: contentType || "application/json; charset=utf-8" };
    if (body instanceof FormData) {
      const entries = [];
      for (const [name, value] of body.entries()) {
        if (value instanceof Blob) entries.push({ name, kind: "blob", filename: value instanceof File ? value.name : "arquivo", type: value.type || "application/octet-stream", base64: await blobBase64(value) });
        else entries.push({ name, kind: "text", value: String(value) });
      }
      return { body: "", formDataJson: JSON.stringify(entries), contentType: "multipart/form-data" };
    }
    if (body instanceof URLSearchParams) return { body: body.toString(), contentType: contentType || "application/x-www-form-urlencoded; charset=utf-8" };
    if (typeof body === "string") return { body, contentType: contentType || "text/plain; charset=utf-8" };
    if (body instanceof Blob) return { bodyBase64: await blobBase64(body), contentType: body.type || contentType || "application/octet-stream" };
    if (body instanceof ArrayBuffer) return { bodyBase64: bytesToBase64(new Uint8Array(body)), contentType: contentType || "application/octet-stream" };
    if (ArrayBuffer.isView(body)) return { bodyBase64: bytesToBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)), contentType: contentType || "application/octet-stream" };
    return { body: String(body), contentType: contentType || "text/plain; charset=utf-8" };
  }

  function safeHeaders(input, init, request) {
    const headers = new Headers(init?.headers || request?.headers || {});
    for (const name of ["host", "connection", "content-length", "cookie", "origin", "referer"]) headers.delete(name);
    return JSON.stringify(Object.fromEntries(headers.entries()));
  }

  function responseFromNative(result) {
    const headers = new Headers();
    const headerData = result?.headers && typeof result.headers === "object" ? result.headers : {};
    for (const [name, value] of Object.entries(headerData)) if (value != null) headers.set(name, String(value));
    if (result?.contentType && !headers.has("content-type")) headers.set("content-type", String(result.contentType));
    if (result?.contentDisposition && !headers.has("content-disposition")) headers.set("content-disposition", String(result.contentDisposition));
    const status = Number(result?.status || 500);
    const body = result?.bodyBase64 ? base64ToBytes(String(result.bodyBase64)) : String(result?.body ?? "");
    return new Response([204, 205, 304].includes(status) ? null : body, { status: Math.min(599, Math.max(200, status)), headers });
  }

  window.fetch = async function santaLuziaNativeSyncFetch(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input);
    if (!sameOrigin(url)) return browserFetch(input, init);
    const parsed = new URL(url, location.href);
    if (!parsed.pathname.startsWith("/api/")) return browserFetch(input, init);
    const method = String(init?.method || request?.method || "GET").toUpperCase();

    if (method === "GET") {
      const liturgy = await localLiturgy(parsed);
      if (liturgy) return liturgy;
    }

    const native = plugin();
    if (!native?.request) throw new TypeError("Sincronizador nativo indisponível.");
    if (init?.signal?.aborted || request?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    const descriptor = await bodyDescriptor(input, init, request);
    const result = await native.request({ path: `${parsed.pathname}${parsed.search}`, method, headersJson: safeHeaders(input, init, request), ...descriptor });
    if (init?.signal?.aborted || request?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    return responseFromNative(result);
  };
  window.__santaLuziaNativeApiFetch = window.fetch;
})();
