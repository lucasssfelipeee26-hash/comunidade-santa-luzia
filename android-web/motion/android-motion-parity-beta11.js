"use strict";

(() => {
  const VERSION = "2.0.0-beta.12";
  const FLAG = "motionClockCompatibilityBeta12";
  if (document.documentElement.dataset[FLAG] === VERSION) return;
  document.documentElement.dataset[FLAG] = VERSION;

  // A Beta 12 não desenha mais troféus próprios aqui. O pódio volta a usar o
  // desenho mais recente da Windows Beta 19 (.sl-r5-card-trophy), evitando a
  // duplicação causada pela camada Beta 11. Esta camada fica apenas como
  // compatibilidade para o relógio de Atrasos em WebViews que ainda entregam
  // o SVG Lucide sem os ponteiros esperados pelo runtime antigo.
  const style = document.createElement("style");
  style.id = "sl-android-clock-compat-beta12";
  style.textContent = `
    svg.sl-b11-live-clock { overflow:visible; }
    svg.sl-b11-live-clock .sl-b11-clock-original { opacity:0 !important; }
    svg.sl-b11-live-clock .sl-b11-clock-hour,
    svg.sl-b11-live-clock .sl-b11-clock-minute,
    svg.sl-b11-live-clock .sl-b11-clock-second {
      transform-box:view-box; transform-origin:12px 12px; stroke:currentColor; stroke-linecap:round;
    }
    svg.sl-b11-live-clock .sl-b11-clock-hour { stroke-width:2.35; }
    svg.sl-b11-live-clock .sl-b11-clock-minute { stroke-width:1.85; }
    svg.sl-b11-live-clock .sl-b11-clock-second { stroke:#d49b20; stroke-width:1.15; transition:transform 120ms linear; }
  `;
  document.head.appendChild(style);

  // Remove imediatamente qualquer troféu da Beta 11 que tenha restado no DOM
  // de uma navegação anterior. A camada Beta 12 de pódio recria somente o
  // troféu oficial atual.
  document.querySelectorAll(".sl-b11-card-trophy").forEach((element) => element.remove());

  function enhanceClock(target) {
    const svg = target.matches?.("svg") ? target : target.querySelector?.("svg");
    if (!svg || svg.classList.contains("sl-b11-live-clock") || svg.classList.contains("sl-r13-native-clock")) return;
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
    document.querySelectorAll(".sl-b11-card-trophy").forEach((element) => element.remove());
    enhanceDelayClocks();
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