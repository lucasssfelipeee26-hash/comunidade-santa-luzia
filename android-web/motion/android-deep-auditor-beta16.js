"use strict";

(() => {
  const VERSION = "2.0.0-beta.16";
  const ROOT_FLAG = "deepAuditorBeta16";
  const LAST_KEY = "santa-luzia:deep-audit:last:v1";
  const DSN_KEY = "santa-luzia:glitchtip-dsn:v1";
  const MAX_FINDINGS = 160;
  const rawFetch = window.fetch.bind(window);
  if (document.documentElement.dataset[ROOT_FLAG] === VERSION) return;
  document.documentElement.dataset[ROOT_FLAG] = VERSION;

  let lastResult = null;
  let dsn = "";
  let glitchTipStatus = { configured: false, connected: false, lastSendAt: null, lastError: null };

  function safeText(value, max = 180) {
    const text = String(value ?? "")
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redigido]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redigido]");
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function visible(el) {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0.5 && rect.height > 0.5;
  }

  function stableSelector(el) {
    if (!(el instanceof Element)) return "unknown";
    const attrs = [
      "data-profile-viewer-banner",
      "data-profile-close",
      "data-team-profile-status-rail",
      "data-bottom-nav-network-stable",
      "data-admin-database-tools",
      "data-auditor-santa-luzia",
      "data-sl-nav-motion",
    ];
    for (const name of attrs) if (el.hasAttribute(name)) return `[${name}${el.getAttribute(name) ? `=\"${safeText(el.getAttribute(name), 40)}\"` : ""}]`;
    if (el.id) return `#${safeText(el.id, 60)}`;
    const cls = [...el.classList].filter((name) => /^sl-|^mobile-|^app-|^lucide/.test(name)).slice(0, 2);
    if (cls.length) return `${el.tagName.toLowerCase()}.${cls.join(".")}`;
    const href = el.getAttribute("href");
    if (href) return `${el.tagName.toLowerCase()}[href=\"${safeText(href, 90)}\"]`;
    return el.tagName.toLowerCase();
  }

  function finding(type, severity, el, detail = {}) {
    return {
      type,
      severity,
      selector: stableSelector(el),
      route: `${location.pathname}${location.search}`,
      ...detail,
    };
  }

  function clippedByAncestor(el) {
    if (!(el instanceof Element)) return null;
    const rect = el.getBoundingClientRect();
    let parent = el.parentElement;
    let guard = 0;
    while (parent && parent !== document.body && guard++ < 12) {
      const style = getComputedStyle(parent);
      const clipsX = /hidden|clip/.test(style.overflowX || style.overflow);
      const clipsY = /hidden|clip/.test(style.overflowY || style.overflow);
      if (clipsX || clipsY) {
        const pr = parent.getBoundingClientRect();
        if ((clipsX && (rect.left < pr.left - 2 || rect.right > pr.right + 2)) || (clipsY && (rect.top < pr.top - 2 || rect.bottom > pr.bottom + 2))) {
          return stableSelector(parent);
        }
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function scanIcons(findings) {
    const icons = [...document.querySelectorAll("svg,.lucide,[data-icon],[data-prayer-person-icon]")];
    let checked = 0;
    for (const icon of icons) {
      if (!visible(icon)) continue;
      checked += 1;
      const rect = icon.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) findings.push(finding("icon-too-small", "warning", icon, { width: Math.round(rect.width), height: Math.round(rect.height) }));
      if (rect.left < -3 || rect.right > innerWidth + 3) findings.push(finding("icon-outside-viewport", "error", icon, { left: Math.round(rect.left), right: Math.round(rect.right), viewport: innerWidth }));
      const clippedBy = clippedByAncestor(icon);
      if (clippedBy) findings.push(finding("icon-clipped", "error", icon, { clippedBy }));
      const host = icon.closest("button,a,[role=button]");
      if (host && visible(host)) {
        const label = host.getAttribute("aria-label") || host.getAttribute("title") || "";
        const hasText = [...host.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && String(node.textContent || "").trim().length > 0) || Boolean(host.querySelector("span:not(.sr-only)"));
        if (!label && !hasText) findings.push(finding("icon-action-without-label", "warning", host));
      }
    }
    return checked;
  }

  function scanInteractive(findings) {
    const items = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button],[role=tab]")];
    let checked = 0;
    for (const el of items) {
      if (!visible(el)) continue;
      checked += 1;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (rect.left < -4 || rect.right > innerWidth + 4) findings.push(finding("interactive-outside-viewport", "error", el, { left: Math.round(rect.left), right: Math.round(rect.right) }));
      if (rect.width < 28 || rect.height < 28) {
        const tag = el.tagName.toLowerCase();
        if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") findings.push(finding("touch-target-small", "warning", el, { width: Math.round(rect.width), height: Math.round(rect.height) }));
      }
      if (style.pointerEvents === "none" && !el.hasAttribute("disabled")) findings.push(finding("interactive-pointer-disabled", "warning", el));
      const clippedBy = clippedByAncestor(el);
      if (clippedBy) findings.push(finding("interactive-clipped", "error", el, { clippedBy }));
    }
    return checked;
  }

  function scanImages(findings) {
    const images = [...document.images];
    let checked = 0;
    for (const img of images) {
      if (!visible(img)) continue;
      checked += 1;
      if (img.complete && img.naturalWidth === 0) findings.push(finding("image-broken", "error", img, { src: safeText(new URL(img.currentSrc || img.src, location.href).pathname, 100) }));
      const clippedBy = clippedByAncestor(img);
      if (clippedBy) findings.push(finding("image-clipped", "warning", img, { clippedBy }));
      if (img.hasAttribute("data-profile-photo-full")) {
        const style = getComputedStyle(img);
        if (style.objectFit !== "contain") findings.push(finding("profile-photo-distorted", "error", img, { objectFit: style.objectFit }));
      }
    }
    return checked;
  }

  function scanLayout(findings) {
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    if (docWidth > innerWidth + 6) findings.push({ type: "document-horizontal-overflow", severity: "error", route: location.pathname, selector: "document", documentWidth: docWidth, viewportWidth: innerWidth });

    const dialogs = [...document.querySelectorAll('[role="dialog"],[data-profile-viewer-banner]')].filter(visible);
    for (const dialog of dialogs) {
      const rect = dialog.getBoundingClientRect();
      if (rect.left < -3 || rect.right > innerWidth + 3 || rect.top < -3 || rect.bottom > innerHeight + 3) findings.push(finding("dialog-outside-viewport", "error", dialog, { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom) }));
      if (dialog.hasAttribute("data-profile-viewer-banner")) {
        if (rect.height < Math.min(420, innerHeight * .48)) findings.push(finding("profile-dialog-collapsed", "error", dialog, { height: Math.round(rect.height), viewportHeight: innerHeight }));
        if (!dialog.querySelector('[data-profile-photo-full], [data-profile-photo-frame="preserve-ratio"]')) findings.push(finding("profile-dialog-content-missing", "error", dialog));
        if (!dialog.querySelector('[data-profile-close="true"]')) findings.push(finding("profile-dialog-close-missing", "error", dialog));
      }
    }

    const nav = document.querySelector('[data-bottom-nav-network-stable="true"]');
    if (nav && visible(nav)) {
      const r = nav.getBoundingClientRect();
      if (r.bottom > innerHeight + 3 || r.top < innerHeight * .68) findings.push(finding("bottom-nav-misaligned", "warning", nav, { top: Math.round(r.top), bottom: Math.round(r.bottom), viewportHeight: innerHeight }));
    }

    const loading = [...document.querySelectorAll("main,body")].find((el) => /Carregando|Abrindo Jornada|Abrindo painel/i.test(String(el.textContent || "")));
    if (loading && document.documentElement.dataset.slRouteTransitionSince) {
      const since = Number(document.documentElement.dataset.slRouteTransitionSince || 0);
      const elapsed = Date.now() - since;
      if (elapsed > 2200) findings.push(finding("route-loading-too-long", "warning", loading, { elapsedMs: elapsed }));
    }
  }

  function scanExpectedNavigation(findings) {
    const nav = document.querySelector('[data-bottom-nav-network-stable="true"]');
    if (!nav || !visible(nav)) return;
    const expected = location.pathname.startsWith("/area-restrita") ? ["/visitante", "/escala", "/formacao", "/area-restrita/ranking"] : ["/visitante", "/liturgia", "/escala", "/biblioteca"];
    for (const href of expected) {
      const link = nav.querySelector(`a[href="${href}"]`);
      if (!link) findings.push({ type: "bottom-nav-item-missing", severity: "error", selector: `a[href=\"${href}\"]`, route: location.pathname, href });
      else if (!link.querySelector("svg,.lucide")) findings.push(finding("bottom-nav-icon-missing", "error", link, { href }));
    }
  }

  function dedupe(findings) {
    const seen = new Set();
    const out = [];
    for (const item of findings) {
      const key = `${item.type}|${item.selector}|${item.route}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_FINDINGS) break;
    }
    return out;
  }

  function parseDsn(value) {
    try {
      const url = new URL(String(value || ""));
      const projectId = url.pathname.split("/").filter(Boolean).pop();
      if (!url.username || !projectId) return null;
      const basePath = url.pathname.split("/").filter(Boolean).slice(0, -1).join("/");
      return {
        publicKey: url.username,
        projectId,
        base: `${url.protocol}//${url.host}${basePath ? `/${basePath}` : ""}`,
      };
    } catch { return null; }
  }

  function randomHex(bytes = 16) {
    const data = new Uint8Array(bytes);
    crypto.getRandomValues(data);
    return [...data].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sendGlitchTip(summary) {
    const parsed = parseDsn(dsn);
    if (!parsed || navigator.onLine === false || document.documentElement.dataset.physicalNetwork === "offline") return { sent: false, reason: parsed ? "offline" : "not-configured" };
    const eventId = randomHex(16);
    const url = `${parsed.base}/api/${encodeURIComponent(parsed.projectId)}/envelope/?sentry_key=${encodeURIComponent(parsed.publicKey)}&sentry_version=7&sentry_client=santa-luzia-deep-auditor%2F1.0`;
    const event = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: summary.errors > 0 ? "error" : summary.warnings > 0 ? "warning" : "info",
      message: `Santa Luzia Deep Scan: ${summary.errors} erro(s), ${summary.warnings} alerta(s)`,
      tags: { app_version: VERSION, route: location.pathname, scanner: "santa-luzia-deep-audit", network: document.documentElement.dataset.physicalNetwork || "unknown" },
      extra: { summary, privacy: "Sem nomes, e-mails, tokens, cookies ou corpos de requisição." },
    };
    const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn })}\n${JSON.stringify({ type: "event", content_type: "application/json" })}\n${JSON.stringify(event)}`;
    try {
      const response = await rawFetch(url, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body: envelope, keepalive: true });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      glitchTipStatus = { configured: true, connected: true, lastSendAt: Date.now(), lastError: null };
      return { sent: true, eventId };
    } catch (error) {
      glitchTipStatus = { configured: true, connected: false, lastSendAt: glitchTipStatus.lastSendAt, lastError: safeText(error?.message || error, 120) };
      return { sent: false, reason: glitchTipStatus.lastError };
    }
  }

  async function resolveDsn() {
    if (dsn) return dsn;
    try { dsn = String(localStorage.getItem(DSN_KEY) || "").trim(); } catch {}
    if (dsn) { glitchTipStatus.configured = true; return dsn; }
    if (navigator.onLine === false) return "";
    try {
      const response = await rawFetch("/api/configuracao/diagnostico", { cache: "no-store", credentials: "same-origin" });
      if (response.ok) {
        const json = await response.json().catch(() => null);
        dsn = String(json?.glitchTipDsn || "").trim();
        if (dsn) {
          localStorage.setItem(DSN_KEY, dsn);
          glitchTipStatus.configured = true;
        }
      }
    } catch {}
    return dsn;
  }

  async function run(options = {}) {
    const started = performance.now();
    const findings = [];
    const checked = {
      icons: scanIcons(findings),
      interactive: scanInteractive(findings),
      images: scanImages(findings),
    };
    scanLayout(findings);
    scanExpectedNavigation(findings);
    const unique = dedupe(findings);
    const summary = {
      findings: unique.length,
      errors: unique.filter((item) => item.severity === "error").length,
      warnings: unique.filter((item) => item.severity === "warning").length,
      checkedIcons: checked.icons,
      checkedInteractive: checked.interactive,
      checkedImages: checked.images,
      durationMs: Math.round(performance.now() - started),
    };
    await resolveDsn();
    const remote = options.sendRemote === false ? { sent: false, reason: "disabled" } : await sendGlitchTip(summary);
    lastResult = { version: VERSION, generatedAt: new Date().toISOString(), route: `${location.pathname}${location.search}`, summary, findings: unique, glitchTip: { ...glitchTipStatus, ...remote }, privacy: "Deep Scan não coleta conteúdo de formulários, nomes, e-mails, cookies, tokens nem corpos de requisição." };
    try { localStorage.setItem(LAST_KEY, JSON.stringify(lastResult)); } catch {}
    window.dispatchEvent(new CustomEvent("santa-luzia:deep-audit-updated", { detail: summary }));
    return lastResult;
  }

  function getLast() {
    if (lastResult) return lastResult;
    try { lastResult = JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch {}
    return lastResult;
  }

  async function configureGlitchTip(value) {
    dsn = String(value || "").trim();
    try { dsn ? localStorage.setItem(DSN_KEY, dsn) : localStorage.removeItem(DSN_KEY); } catch {}
    glitchTipStatus = { configured: Boolean(parseDsn(dsn)), connected: false, lastSendAt: null, lastError: null };
    return { ...glitchTipStatus };
  }

  window.SantaLuziaDeepAudit = {
    version: VERSION,
    run,
    getLast,
    configureGlitchTip,
    getGlitchTipStatus: () => ({ ...glitchTipStatus }),
  };

  void resolveDsn();
})();
