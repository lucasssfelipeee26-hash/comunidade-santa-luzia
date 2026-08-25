"use strict";

(() => {
  const VERSION = "2.0.0-beta.12";
  const FLAG = "dbHealthBeta12";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  async function auditDatabase() {
    const store = window.Capacitor?.Plugins?.OfflineStore;
    if (!store?.health) return null;
    try {
      const result = await store.health();
      const ok = result?.ok === true && String(result?.integrity || "").toLowerCase() === "ok";
      window.SantaLuziaAuditor?.add?.("local-db-health", ok ? "info" : "error", {
        integrity: String(result?.integrity || "unknown").slice(0, 60),
        journalMode: String(result?.journalMode || "unknown").slice(0, 30),
        version: Number(result?.version || 0),
        documents: Number(result?.documents || 0),
        backups: Number(result?.backups || 0),
        sizeBytes: Number(result?.sizeBytes || 0),
      });
      return result;
    } catch (error) {
      window.SantaLuziaAuditor?.add?.("local-db-health", "error", { message: String(error?.message || error || "Falha no SQLite").slice(0, 240) });
      return null;
    }
  }

  window.SantaLuziaDatabaseAudit = auditDatabase;
  window.addEventListener("santa-luzia:diagnostico-run", () => void auditDatabase());
  window.addEventListener("focus", () => void auditDatabase());
  setTimeout(() => void auditDatabase(), 1800);
})();
