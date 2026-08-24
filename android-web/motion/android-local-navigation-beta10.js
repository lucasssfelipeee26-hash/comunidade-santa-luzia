"use strict";

(() => {
  const VERSION = "2.0.0-beta.10";
  const FLAG = "motionLocalNavigationBeta10";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  function navigate(url, replace = false) {
    const target = `${url.pathname}${url.search}${url.hash}`;
    if (replace) history.replaceState(history.state, "", target);
    else history.pushState(history.state, "", target);
    window.dispatchEvent(new Event("santa-luzia:local-route"));
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function filenameFromDisposition(value, fallback) {
    const text = String(value || "");
    const utf = text.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf?.[1]) { try { return decodeURIComponent(utf[1].replace(/["']/g, "")); } catch {} }
    const plain = text.match(/filename="?([^";]+)"?/i);
    return (plain?.[1] || fallback || "arquivo").replace(/[\\/:*?"<>|]/g, "-");
  }

  async function downloadApi(url, anchor) {
    const response = await fetch(`${url.pathname}${url.search}`, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const fallback = anchor.getAttribute("download") || url.pathname.split("/").filter(Boolean).at(-1) || "arquivo";
    const filename = filenameFromDisposition(response.headers.get("content-disposition"), fallback);
    const local = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = local;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(local), 5000);
    }
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;

    if (url.pathname.startsWith("/api/") && /\/download(?:\/|$)/.test(url.pathname)) {
      event.preventDefault();
      void downloadApi(url, anchor).catch(() => {
        window.dispatchEvent(new CustomEvent("santa-luzia:download-error", { detail: { path: url.pathname } }));
      });
      return;
    }
    if (url.pathname.startsWith("/api/")) return;
    event.preventDefault();
    navigate(url, false);
  }, true);
})();
