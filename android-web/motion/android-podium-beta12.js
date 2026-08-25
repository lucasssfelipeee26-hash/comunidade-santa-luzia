"use strict";

(() => {
  const VERSION = "2.0.0-beta.12";
  const FLAG = "podiumBeta12";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  // O desenho abaixo é o mesmo formato usado pela Windows Beta 19 atual.
  // A Beta 12 só garante que exista exatamente um por posição e remove os
  // troféus antigos que ficaram sobrepostos em builds anteriores.
  function text(element) {
    return String(element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function trophyMarkup(rank) {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="slB12Cup${rank}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--sl-cup-light)"/><stop offset=".45" stop-color="var(--sl-cup-main)"/><stop offset="1" stop-color="var(--sl-cup-dark)"/></linearGradient></defs><g fill="url(#slB12Cup${rank})"><path d="M18 8h28v8c0 13-5 22-11 26v7h7v5H22v-5h7v-7c-6-4-11-13-11-26z"/><path d="M18 13H9v7c0 9 5 15 12 17v-6c-4-2-6-6-6-11v-1h3zm28 0h9v7c0 9-5 15-12 17v-6c4-2 6-6 6-11v-1h-3z"/><rect x="17" y="54" width="30" height="5" rx="2.5"/></g><path d="M25 13h14c-1 10-3 17-7 21-4-4-6-11-7-21z" fill="var(--sl-cup-light)" opacity=".25"/></svg>`;
  }

  function rankOf(card) {
    const explicit = Number(card?.dataset?.slRank || card?.dataset?.rank || card?.dataset?.slB11Rank || 0);
    if (explicit >= 1 && explicit <= 3) return explicit;
    for (const element of card?.querySelectorAll?.("span,b,strong,p") || []) {
      const value = text(element);
      const match = value.match(/^([123])º$/);
      if (match) return Number(match[1]);
    }
    return 0;
  }

  function findCard(section, rank) {
    const selectors = [
      `.sl-podium-${rank}`,
      `.sl-b7-podium[data-sl-rank="${rank}"]`,
      `.sl-b11-podium-card[data-sl-b11-rank="${rank}"]`,
    ];
    for (const selector of selectors) {
      const card = section.querySelector(selector);
      if (card) return card;
    }
    const candidates = [...section.querySelectorAll("article,li,section > div > div")];
    return candidates.find((candidate) => rankOf(candidate) === rank) || null;
  }

  function normalizeCard(card, rank) {
    if (!(card instanceof HTMLElement)) return;
    if (getComputedStyle(card).position === "static") card.style.position = "relative";

    card.style.removeProperty("opacity");
    card.style.removeProperty("filter");
    card.querySelectorAll("p,strong,b,[data-slot='avatar']").forEach((element) => {
      if (element instanceof HTMLElement) {
        element.style.removeProperty("opacity");
        element.style.removeProperty("filter");
        element.style.removeProperty("visibility");
      }
    });

    // Elimina todas as gerações anteriores e qualquer cópia extra da atual.
    card.querySelectorAll(".sl-b11-card-trophy,.sl-b7-trophy,.sl-trophy-3d,.sl-r3-card-trophy").forEach((element) => element.remove());
    const current = [...card.querySelectorAll(":scope > .sl-r5-card-trophy")];
    current.filter((element) => element.getAttribute("data-rank") !== String(rank)).forEach((element) => element.remove());
    const valid = [...card.querySelectorAll(`:scope > .sl-r5-card-trophy[data-rank="${rank}"]`)];
    valid.slice(1).forEach((element) => element.remove());

    let trophy = valid[0] || null;
    if (!trophy) {
      trophy = document.createElement("span");
      trophy.className = "sl-r5-card-trophy";
      trophy.dataset.rank = String(rank);
      trophy.setAttribute("aria-label", `Troféu do ${rank}º lugar`);
      trophy.innerHTML = trophyMarkup(rank);
      card.appendChild(trophy);
    }

    // O runtime da Windows Beta já fornece o CSS/cores/animação desta classe.
    // Reescrever o SVG garante que builds antigas não mantenham desenho anterior.
    if (!trophy.querySelector("svg[viewBox='0 0 64 64']")) trophy.innerHTML = trophyMarkup(rank);
  }

  function apply() {
    document.querySelectorAll(".sl-b11-card-trophy").forEach((element) => element.remove());
    const title = [...document.querySelectorAll("main h1,main h2,main h3")].find((element) => text(element) === "Pódio da equipe");
    const section = title?.closest("section");
    if (!section) return;
    for (const rank of [1, 2, 3]) {
      const card = findCard(section, rank);
      if (card) normalizeCard(card, rank);
    }

    const trophies = section.querySelectorAll(".sl-r5-card-trophy");
    const duplicates = Math.max(0, trophies.length - 3);
    if (duplicates) {
      try { window.SantaLuziaAuditor?.add?.("podium-duplicate-cleanup", "warning", { duplicatesRemoved: duplicates }); } catch {}
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("santa-luzia:local-route", () => setTimeout(apply, 0));
  window.addEventListener("popstate", () => setTimeout(apply, 0));
  apply();
})();
