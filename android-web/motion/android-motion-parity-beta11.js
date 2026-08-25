"use strict";

(() => {
  const VERSION = "2.0.0-beta.11";
  const FLAG = "motionParityBeta11";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  const style = document.createElement("style");
  style.id = "sl-android-motion-parity-beta11";
  style.textContent = `
    [data-motion-personal-report="true"] > button svg {
      transform-box:fill-box; transform-origin:center; will-change:transform;
      animation:slB11ReportPage 2.8s ease-in-out infinite;
    }
    @keyframes slB11ReportPage {
      0%,100%{transform:perspective(80px) rotateY(0deg) translateY(0)}
      50%{transform:perspective(80px) rotateY(-13deg) translateY(-1px)}
    }

    svg.sl-b11-live-clock { overflow:visible; }
    svg.sl-b11-live-clock .sl-b11-clock-original { opacity:0 !important; }
    svg.sl-b11-live-clock .sl-b11-clock-hour,
    svg.sl-b11-live-clock .sl-b11-clock-minute,
    svg.sl-b11-live-clock .sl-b11-clock-second {
      transform-box:view-box; transform-origin:12px 12px; stroke:currentColor; stroke-linecap:round;
    }
    svg.sl-b11-live-clock .sl-b11-clock-hour { stroke-width:2.35; }
    svg.sl-b11-live-clock .sl-b11-clock-minute { stroke-width:1.85; }
    svg.sl-b11-live-clock .sl-b11-clock-second { stroke:#d49b20; stroke-width:1.15; transition:transform 150ms linear; }

    .sl-b11-podium-card {
      position:relative !important; isolation:isolate; opacity:1 !important; visibility:visible !important;
      filter:none !important; color:var(--foreground) !important; transform-style:preserve-3d;
      overflow:visible !important;
    }
    .sl-b11-podium-card * { visibility:visible !important; }
    .sl-b11-podium-card p, .sl-b11-podium-card strong, .sl-b11-podium-card b { opacity:1 !important; filter:none !important; }
    .sl-b11-podium-card [data-slot="avatar"] {
      opacity:1 !important; filter:none !important; transform-style:preserve-3d;
      animation:slB11AvatarIntro 1.05s cubic-bezier(.2,.78,.2,1) both, slB11AvatarFloat 4.8s ease-in-out 1.05s infinite;
      backface-visibility:hidden;
    }
    .sl-b11-podium-card[data-sl-b11-rank="1"] { border-color:rgba(197,151,45,.72) !important; background:linear-gradient(145deg,#fffdf3,#fff7d9,#fff) !important; }
    .sl-b11-podium-card[data-sl-b11-rank="2"] { border-color:rgba(144,157,168,.62) !important; background:linear-gradient(145deg,#fff,#f1f4f6,#fff) !important; }
    .sl-b11-podium-card[data-sl-b11-rank="3"] { border-color:rgba(180,104,63,.62) !important; background:linear-gradient(145deg,#fffaf6,#f8e4d7,#fff) !important; }
    @keyframes slB11AvatarIntro {
      0%{opacity:.18;transform:perspective(420px) rotateY(-52deg) scale(.88)}
      68%{opacity:1;transform:perspective(420px) rotateY(8deg) scale(1.035)}
      100%{opacity:1;transform:perspective(420px) rotateY(0deg) scale(1)}
    }
    @keyframes slB11AvatarFloat {
      0%,100%{transform:perspective(420px) rotateY(-4deg) translateY(0)}
      50%{transform:perspective(420px) rotateY(5deg) translateY(-2px)}
    }
    .sl-b11-card-trophy {
      --cup:#d9aa28; --cup-dark:#76500b; position:absolute; right:7px; top:7px; z-index:30;
      display:grid; place-items:center; width:38px; height:38px; pointer-events:none;
      color:var(--cup); filter:drop-shadow(0 7px 6px color-mix(in srgb,var(--cup-dark) 36%,transparent));
      animation:slB11CupFloat 3.5s ease-in-out infinite; transform-style:preserve-3d;
    }
    .sl-b11-card-trophy[data-rank="1"]{--cup:#d7aa24;--cup-dark:#76500b;width:44px;height:44px;top:4px}
    .sl-b11-card-trophy[data-rank="2"]{--cup:#aeb9c1;--cup-dark:#59656e;animation-delay:-1.1s}
    .sl-b11-card-trophy[data-rank="3"]{--cup:#b96f42;--cup-dark:#6f351d;animation-delay:-2.2s}
    .sl-b11-card-trophy svg{width:100%;height:100%;overflow:visible}
    @keyframes slB11CupFloat {
      0%,100%{transform:perspective(360px) translateY(0) rotateY(-10deg) rotateX(2deg)}
      50%{transform:perspective(360px) translateY(-4px) rotateY(11deg) rotateX(-2deg)}
    }
    @media (prefers-reduced-motion:reduce) {
      [data-motion-personal-report="true"] > button svg,
      .sl-b11-podium-card [data-slot="avatar"], .sl-b11-card-trophy { animation:none !important; }
    }
  `;
  document.head.appendChild(style);

  function text(element) { return String(element?.textContent || "").replace(/\s+/g, " ").trim(); }
  function trophyMarkup() {
    return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none">
      <path d="M14 8h20v8c0 9-4.1 15-10 17-5.9-2-10-8-10-17V8Z" fill="currentColor" stroke="var(--cup-dark)" stroke-width="1.4"/>
      <path d="M14 12H7v4c0 7 4 11 10 12M34 12h7v4c0 7-4 11-10 12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <path d="M24 33v7M16 43h16" stroke="var(--cup-dark)" stroke-width="4" stroke-linecap="round"/>
      <path d="M19 11h10c-.7 7-2.3 12-5 15-2.7-3-4.3-8-5-15Z" fill="#fff7bd" opacity=".42"/>
    </svg>`;
  }

  function normalizeTrophy(card, rank) {
    // Camadas antigas de Motion também injetavam um troféu. Elas podem rodar
    // novamente depois desta camada; por isso a limpeza precisa acontecer em
    // toda passagem do MutationObserver, e não somente na primeira criação.
    card.querySelectorAll('[class*="card-trophy"]:not(.sl-b11-card-trophy)').forEach((element) => element.remove());
    const atuais = [...card.querySelectorAll(":scope > .sl-b11-card-trophy")];
    atuais.slice(1).forEach((element) => element.remove());
    let trophy = atuais[0] || null;
    if (!trophy) {
      trophy = document.createElement("span");
      trophy.className = "sl-b11-card-trophy";
      trophy.innerHTML = trophyMarkup();
      card.appendChild(trophy);
    }
    trophy.dataset.rank = String(rank);
    trophy.setAttribute("aria-label", `Troféu do ${rank}º lugar`);
  }

  function enhancePodium() {
    const title = [...document.querySelectorAll("main h1,main h2,main h3")].find((element) => text(element) === "Pódio da equipe");
    const section = title?.closest("section");
    if (!section) return;
    for (const rank of [1, 2, 3]) {
      const label = [...section.querySelectorAll("span")].find((element) => text(element) === `${rank}º`);
      const card = label?.parentElement;
      if (!card) continue;
      card.classList.add("sl-b11-podium-card");
      card.dataset.slB11Rank = String(rank);
      card.style.removeProperty("opacity");
      card.style.removeProperty("filter");
      card.querySelectorAll("p,strong,b,[data-slot='avatar']").forEach((element) => {
        element.style.removeProperty("opacity");
        element.style.removeProperty("filter");
      });
      normalizeTrophy(card, rank);
    }
  }

  function enhanceClock(target) {
    const svg = target.matches?.("svg") ? target : target.querySelector?.("svg");
    if (!svg || svg.classList.contains("sl-b11-live-clock")) return;
    const circle = svg.querySelector("circle");
    if (!circle) return;
    svg.classList.add("sl-b11-live-clock");
    [...svg.children].forEach((child) => {
      if (child !== circle && !child.classList.contains("sl-b11-clock-hour") && !child.classList.contains("sl-b11-clock-minute") && !child.classList.contains("sl-b11-clock-second")) child.classList.add("sl-b11-clock-original");
    });
    for (const [className, y2, width] of [["sl-b11-clock-hour","8","2.35"],["sl-b11-clock-minute","6","1.85"],["sl-b11-clock-second","5","1.15"]]) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", className);
      line.setAttribute("x1", "12"); line.setAttribute("y1", "12"); line.setAttribute("x2", "12"); line.setAttribute("y2", y2); line.setAttribute("stroke-width", width);
      svg.appendChild(line);
    }
  }

  function enhanceDelayClocks() {
    const targets = [...document.querySelectorAll('[data-sl-nav-motion="clock"],a[href*="/area-restrita/atrasos"]')];
    targets.forEach(enhanceClock);
  }

  function tickClocks() {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const angles = { hour: hours * 30, minute: minutes * 6, second: seconds * 6 };
    document.querySelectorAll("svg.sl-b11-live-clock").forEach((svg) => {
      const hour = svg.querySelector(".sl-b11-clock-hour");
      const minute = svg.querySelector(".sl-b11-clock-minute");
      const second = svg.querySelector(".sl-b11-clock-second");
      if (hour) hour.style.transform = `rotate(${angles.hour}deg)`;
      if (minute) minute.style.transform = `rotate(${angles.minute}deg)`;
      if (second) second.style.transform = `rotate(${angles.second}deg)`;
    });
  }

  function apply() {
    enhanceDelayClocks();
    enhancePodium();
    tickClocks();
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("santa-luzia:local-route", () => setTimeout(apply, 0));
  window.addEventListener("popstate", () => setTimeout(apply, 0));
  setInterval(tickClocks, 500);
  apply();
})();
