"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"

const BUILD_MOTION = 19

function androidNativo() {
  if (typeof window === "undefined") return false
  try {
    return Capacitor.getPlatform() === "android"
      || document.documentElement.dataset.nativePlatform === "android"
      || navigator.userAgent.includes("SantaLuziaAndroid")
  } catch {
    return navigator.userAgent.includes("SantaLuziaAndroid")
  }
}

function texto(el: Element | null | undefined) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim()
}

function retrigger(el: Element | null | undefined, classe: string) {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return
  el.classList.remove(classe)
  if (el instanceof HTMLElement) void el.offsetWidth
  else void el.getBoundingClientRect().width
  el.classList.add(classe)
}

const TROFEU_3D = `
  <span class="motion2-trophy-stage" data-motion2-trophy="true" aria-hidden="true">
    <svg class="motion2-trophy-model" viewBox="0 0 96 96" role="presentation">
      <defs>
        <linearGradient id="motion2GoldFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff0a8"/>
          <stop offset="0.22" stop-color="#f4ce58"/>
          <stop offset="0.52" stop-color="#b77c17"/>
          <stop offset="0.78" stop-color="#f2c94c"/>
          <stop offset="1" stop-color="#8b5a11"/>
        </linearGradient>
        <linearGradient id="motion2GoldStem" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8f5d14"/>
          <stop offset="0.45" stop-color="#ffe58a"/>
          <stop offset="0.72" stop-color="#d49a24"/>
          <stop offset="1" stop-color="#75470c"/>
        </linearGradient>
        <radialGradient id="motion2GoldGlow" cx="38%" cy="20%" r="78%">
          <stop offset="0" stop-color="#fffbe0" stop-opacity=".95"/>
          <stop offset=".45" stop-color="#f2c94c" stop-opacity=".52"/>
          <stop offset="1" stop-color="#7d4c0b" stop-opacity="0"/>
        </radialGradient>
        <filter id="motion2TrophyShadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#5b3508" flood-opacity=".34"/>
        </filter>
      </defs>
      <g filter="url(#motion2TrophyShadow)">
        <path d="M29 18h38v12c0 21-8 33-19 33S29 51 29 30V18Z" fill="url(#motion2GoldFace)" stroke="#8b5a11" stroke-width="2"/>
        <path d="M29 25H18v8c0 13 7 21 17 22" fill="none" stroke="url(#motion2GoldFace)" stroke-width="7" stroke-linecap="round"/>
        <path d="M67 25h11v8c0 13-7 21-17 22" fill="none" stroke="url(#motion2GoldFace)" stroke-width="7" stroke-linecap="round"/>
        <ellipse cx="48" cy="20" rx="19" ry="5.5" fill="#ffe98c" stroke="#9d6812" stroke-width="1.8"/>
        <path d="M43 62h10v13H43z" fill="url(#motion2GoldStem)"/>
        <path d="M34 77h28l5 9H29l5-9Z" fill="url(#motion2GoldFace)" stroke="#8b5a11" stroke-width="2"/>
        <ellipse cx="48" cy="86" rx="20" ry="4.5" fill="#8e5c13" opacity=".62"/>
        <path d="M38 24c1 17 4 26 11 32" fill="none" stroke="#fff7c4" stroke-width="4" stroke-linecap="round" opacity=".62"/>
        <ellipse cx="48" cy="39" rx="13" ry="18" fill="url(#motion2GoldGlow)" opacity=".58"/>
      </g>
    </svg>
  </span>
`

function prepararPodio() {
  const titulo = Array.from(document.querySelectorAll("h1,h2,h3,p"))
    .find((el) => texto(el).includes("Pódio da equipe"))
  const secao = titulo?.closest("section")
  if (!(secao instanceof HTMLElement)) return

  secao.classList.add("motion2-podium")
  const grade = Array.from(secao.querySelectorAll(":scope > div"))
    .find((el) => el.classList.contains("grid") && el.classList.contains("grid-cols-3"))

  if (grade instanceof HTMLElement) {
    grade.classList.add("motion2-podium-grid")
    Array.from(grade.children).forEach((card) => {
      if (!(card instanceof HTMLElement)) return
      const badge = Array.from(card.querySelectorAll("span")).find((span) => /^[123]º$/.test(texto(span)))
      const posicao = Number.parseInt(texto(badge), 10)
      if (!Number.isInteger(posicao) || posicao < 1 || posicao > 3) return

      card.classList.add("motion2-podium-card", `motion2-place-${posicao}`)
      card.style.order = posicao === 1 ? "2" : posicao === 2 ? "1" : "3"
      card.style.setProperty("--motion-delay", `${posicao === 1 ? 80 : posicao === 2 ? 150 : 220}ms`)
      if (badge instanceof HTMLElement) badge.classList.add("motion2-position-badge")
      const avatar = card.querySelector("[data-slot='avatar']") || card.querySelector("img")?.parentElement
      if (avatar instanceof HTMLElement) avatar.classList.add("motion2-avatar-orbit")
    })
  }

  const cabecalho = titulo?.parentElement?.parentElement
  if (cabecalho instanceof HTMLElement) {
    const original = Array.from(cabecalho.querySelectorAll("svg")).find((svg) => !svg.closest("[data-motion2-trophy]"))
    if (original instanceof SVGElement) original.classList.add("motion2-trophy-original")
    if (!cabecalho.querySelector("[data-motion2-trophy]")) cabecalho.insertAdjacentHTML("beforeend", TROFEU_3D)
  }
}

function prepararFormacao(pathname: string) {
  if (!pathname.includes("formacao")) return
  const candidatos = Array.from(document.querySelectorAll("main section, main article"))
    .filter((el) => el instanceof HTMLElement && /rounded|border|shadow/.test(el.className))
    .slice(0, 18)
  candidatos.forEach((el, indice) => {
    const card = el as HTMLElement
    card.classList.add("motion2-formation-card")
    card.style.setProperty("--motion-delay", `${Math.min(indice, 7) * 48}ms`)
  })
}

function prepararLogo() {
  const logo = document.querySelector("img[alt='Santa Luzia']")?.parentElement
  if (logo instanceof HTMLElement) logo.classList.add("motion2-santa-logo")
}

function prepararDialogos() {
  document.querySelectorAll("[role='dialog']").forEach((dialogo) => {
    if (dialogo instanceof HTMLElement) dialogo.classList.add("motion2-dialog")
  })
}

function prepararNotificacoes() {
  document.querySelectorAll("[aria-live='polite'], [aria-live='assertive']").forEach((el) => {
    if (el instanceof HTMLElement && el.children.length > 0) el.classList.add("motion2-live-region")
  })
}

function prepararTudo(pathname: string) {
  prepararLogo()
  prepararPodio()
  prepararFormacao(pathname)
  prepararDialogos()
  prepararNotificacoes()
}

const CSS = String.raw`
  .motion2-enabled { --motion2-ease:cubic-bezier(.2,.72,.22,1); --motion2-spring:cubic-bezier(.18,.9,.22,1.08); }
  .motion2-enabled main.motion2-page-enter { animation:motion2PageIn 210ms var(--motion2-ease) both; will-change:opacity,transform; }
  .motion2-enabled :is(button,a,[role='button']):not([aria-disabled='true']) { transition:scale 120ms ease,box-shadow 180ms ease,background-color 180ms ease,color 180ms ease,border-color 180ms ease,opacity 180ms ease; -webkit-tap-highlight-color:transparent; }
  .motion2-enabled :is(button,a,[role='button']):not([aria-disabled='true']):active { scale:.982; }
  .motion2-enabled .mobile-app-bottom-nav { animation:motion2NavRise 280ms var(--motion2-ease) both; }
  .motion2-enabled .mobile-app-bottom-nav [aria-current='page'] > span { animation:motion2NavActive 280ms var(--motion2-spring) both; box-shadow:0 8px 18px rgba(123,19,38,.18); }
  .motion2-enabled .mobile-app-bottom-nav [aria-current='page'] svg { animation:motion2IconPop 250ms var(--motion2-spring) both; }

  .motion2-enabled .motion2-santa-logo { position:relative; transform-style:preserve-3d; isolation:isolate; }
  .motion2-enabled .motion2-santa-logo.motion2-logo-enter { animation:motion2LogoEnter 520ms var(--motion2-ease) both; }
  .motion2-enabled .motion2-santa-logo.motion2-logo-refresh { animation:motion2LogoRefresh 620ms var(--motion2-ease) both; }
  .motion2-enabled .motion2-santa-logo::after { content:""; position:absolute; inset:-3px; z-index:-1; border-radius:999px; pointer-events:none; border:1px solid rgba(211,174,78,.45); box-shadow:0 0 0 0 rgba(211,174,78,0); opacity:0; }
  .motion2-enabled .motion2-santa-logo.motion2-logo-enter::after,.motion2-enabled .motion2-santa-logo.motion2-logo-refresh::after { animation:motion2LogoHalo 700ms ease both; }

  .motion2-enabled .motion2-podium { position:relative; overflow:hidden; perspective:900px; background:radial-gradient(circle at 50% -8%,rgba(218,181,88,.18),transparent 42%),rgba(255,255,255,.76); }
  .motion2-enabled .motion2-podium-grid { align-items:end; gap:.55rem; padding-top:.55rem; }
  .motion2-enabled .motion2-podium-card { isolation:isolate; overflow:visible; transform-style:preserve-3d; min-height:188px; padding:.72rem .48rem .62rem !important; border-color:transparent !important; animation:motion2PodiumCardIn 560ms var(--motion2-spring) both; animation-delay:var(--motion-delay,0ms); }
  .motion2-enabled .motion2-podium-card::before { content:""; position:absolute; inset:-2px; z-index:-2; border-radius:24px; padding:2px; pointer-events:none; background:conic-gradient(from 20deg,transparent 0 8%,var(--motion-metal) 18%,#fff9df 24%,var(--motion-metal) 31%,transparent 42% 58%,var(--motion-metal) 70%,#fff 75%,var(--motion-metal) 80%,transparent 91%); -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; animation:motion2BorderOrbit 4.2s linear infinite; opacity:.96; }
  .motion2-enabled .motion2-podium-card::after { content:""; position:absolute; inset:2px; z-index:-3; border-radius:20px; pointer-events:none; box-shadow:0 0 24px var(--motion-glow); opacity:.62; }
  .motion2-enabled .motion2-place-1 { --motion-metal:#d5a91e; --motion-glow:rgba(222,172,34,.42); min-height:210px; translate:0 -9px; box-shadow:0 18px 38px rgba(157,111,14,.16) !important; }
  .motion2-enabled .motion2-place-2 { --motion-metal:#aeb5c1; --motion-glow:rgba(145,157,176,.34); box-shadow:0 13px 30px rgba(80,92,110,.12) !important; }
  .motion2-enabled .motion2-place-3 { --motion-metal:#b97543; --motion-glow:rgba(181,108,59,.34); box-shadow:0 13px 30px rgba(128,76,42,.12) !important; }
  .motion2-enabled .motion2-position-badge { display:flex !important; align-items:center; justify-content:center; min-width:44px; height:25px; padding:0 9px !important; font-size:11px !important; line-height:1; letter-spacing:.02em; border:1px solid rgba(255,255,255,.72); box-shadow:0 5px 14px rgba(55,36,19,.13); }
  .motion2-enabled .motion2-place-1 .motion2-position-badge { min-width:48px; height:28px; font-size:12px !important; background:linear-gradient(135deg,#f6d969,#b9891b) !important; color:#3b2b08 !important; }
  .motion2-enabled .motion2-place-2 .motion2-position-badge { background:linear-gradient(135deg,#eef1f5,#abb3bf) !important; color:#39414c !important; }
  .motion2-enabled .motion2-place-3 .motion2-position-badge { background:linear-gradient(135deg,#e7b087,#a86538) !important; color:#452815 !important; }
  .motion2-enabled .motion2-avatar-orbit { position:relative; transform-style:preserve-3d; backface-visibility:visible; animation:motion2AvatarTurn 1120ms cubic-bezier(.18,.78,.2,1) both; animation-delay:calc(var(--motion-delay,0ms) + 100ms); border-width:3px !important; box-shadow:0 7px 18px rgba(47,31,24,.16),0 0 0 3px rgba(255,255,255,.86); }
  .motion2-enabled .motion2-place-1 .motion2-avatar-orbit { width:76px !important; height:76px !important; }
  .motion2-enabled .motion2-place-2 .motion2-avatar-orbit,.motion2-enabled .motion2-place-3 .motion2-avatar-orbit { width:62px !important; height:62px !important; }

  .motion2-enabled .motion2-trophy-original { display:none !important; }
  .motion2-enabled .motion2-trophy-stage { display:grid; place-items:center; width:58px; height:58px; flex:0 0 58px; perspective:620px; border-radius:20px; background:radial-gradient(circle at 35% 28%,rgba(255,247,198,.92),rgba(234,199,101,.24) 42%,rgba(142,92,18,.08) 70%,transparent 72%); box-shadow:inset 0 0 0 1px rgba(196,151,53,.18),0 9px 24px rgba(116,73,14,.14); }
  .motion2-enabled .motion2-trophy-model { width:52px; height:52px; overflow:visible; transform-style:preserve-3d; transform-origin:50% 58%; animation:motion2Trophy3d 3.4s ease-in-out infinite; }

  .motion2-enabled .motion2-score-pop { animation:motion2ScorePop 400ms var(--motion2-spring) both; }
  .motion2-enabled .motion2-formation-card { animation:motion2FormationIn 360ms var(--motion2-ease) both; animation-delay:var(--motion-delay,0ms); transform-origin:50% 100%; }
  .motion2-enabled .motion2-dialog { animation:motion2Backdrop 160ms ease both; }
  .motion2-enabled .motion2-dialog > :is(section,div):not([aria-hidden='true']) { animation:motion2SheetIn 300ms var(--motion2-spring) both; }
  .motion2-enabled .motion2-live-region > * { animation:motion2NoticeIn 280ms var(--motion2-ease) both; }

  @keyframes motion2PageIn { from{opacity:.35;transform:translate3d(0,7px,0)} to{opacity:1;transform:translate3d(0,0,0)} }
  @keyframes motion2NavRise { from{opacity:0;transform:translate3d(0,10px,0)} to{opacity:1;transform:none} }
  @keyframes motion2NavActive { 0%{scale:.94;translate:0 1px} 70%{scale:1.055;translate:0 -2px} 100%{scale:1.025;translate:0 -1px} }
  @keyframes motion2IconPop { 0%{scale:.82} 70%{scale:1.1} 100%{scale:1} }
  @keyframes motion2LogoEnter { 0%{opacity:.35;scale:.94;rotate:-2deg} 70%{opacity:1;scale:1.025;rotate:.7deg} 100%{opacity:1;scale:1;rotate:0deg} }
  @keyframes motion2LogoRefresh { 0%{scale:1;rotate:0deg} 38%{scale:1.035;rotate:7deg} 68%{scale:1.015;rotate:-4deg} 100%{scale:1;rotate:0deg} }
  @keyframes motion2LogoHalo { 0%{opacity:0;box-shadow:0 0 0 0 rgba(211,174,78,.35)} 45%{opacity:1;box-shadow:0 0 0 5px rgba(211,174,78,.12)} 100%{opacity:0;box-shadow:0 0 0 10px rgba(211,174,78,0)} }
  @keyframes motion2PodiumCardIn { from{opacity:0;transform:translate3d(0,16px,0) rotateX(5deg)} to{opacity:1;transform:none} }
  @keyframes motion2AvatarTurn { 0%{transform:perspective(520px) rotateY(-210deg) scale(.84);opacity:.25} 58%{transform:perspective(520px) rotateY(18deg) scale(1.045);opacity:1} 78%{transform:perspective(520px) rotateY(-7deg) scale(1.015)} 100%{transform:perspective(520px) rotateY(0deg) scale(1);opacity:1} }
  @keyframes motion2Trophy3d { 0%,100%{transform:rotateY(-14deg) rotateX(3deg) translateY(0)} 50%{transform:rotateY(15deg) rotateX(-2deg) translateY(-3px)} }
  @keyframes motion2BorderOrbit { to{transform:rotate(360deg)} }
  @keyframes motion2ScorePop { 0%{scale:.9;opacity:.45} 65%{scale:1.09;opacity:1} 100%{scale:1;opacity:1} }
  @keyframes motion2FormationIn { from{opacity:0;transform:translateY(11px)} to{opacity:1;transform:none} }
  @keyframes motion2Backdrop { from{background-color:rgba(22,11,14,0)} to{} }
  @keyframes motion2SheetIn { from{opacity:.35;transform:translateY(22px)} to{opacity:1;transform:none} }
  @keyframes motion2NoticeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }

  @media (min-width:640px) {
    .motion2-enabled .motion2-podium-grid { gap:.85rem; }
    .motion2-enabled .motion2-place-1 .motion2-avatar-orbit { width:86px !important; height:86px !important; }
    .motion2-enabled .motion2-place-2 .motion2-avatar-orbit,.motion2-enabled .motion2-place-3 .motion2-avatar-orbit { width:70px !important; height:70px !important; }
  }
  @media (prefers-reduced-motion:reduce) {
    .motion2-enabled *, .motion2-enabled *::before, .motion2-enabled *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; transition-duration:.001ms !important; }
  }
`

export function Motion2Runtime() {
  const pathname = usePathname()
  const [ativo, setAtivo] = useState(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const scanPendente = useRef<number | null>(null)

  useEffect(() => {
    let cancelado = false
    if (!androidNativo()) {
      setAtivo(true)
      return
    }
    void import("@capacitor/app").then(async ({ App }) => {
      const info = await App.getInfo()
      const build = Number.parseInt(info.build, 10)
      if (!cancelado) setAtivo(Number.isFinite(build) && build >= BUILD_MOTION)
    }).catch(() => { if (!cancelado) setAtivo(false) })
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    if (!ativo) {
      document.body.classList.remove("motion2-enabled")
      return
    }

    document.body.classList.add("motion2-enabled")
    const agendarScan = () => {
      if (scanPendente.current != null) return
      scanPendente.current = window.requestAnimationFrame(() => {
        scanPendente.current = null
        prepararTudo(pathname)
      })
    }

    prepararTudo(pathname)
    const main = document.querySelector("main")
    if (main instanceof HTMLElement) retrigger(main, "motion2-page-enter")
    retrigger(document.querySelector("img[alt='Santa Luzia']")?.parentElement, "motion2-logo-enter")

    observerRef.current?.disconnect()
    observerRef.current = new MutationObserver(agendarScan)
    observerRef.current.observe(document.body, { childList:true, subtree:true })

    const sincronizou = () => {
      retrigger(document.querySelector("img[alt='Santa Luzia']")?.parentElement, "motion2-logo-refresh")
      document.querySelectorAll(".motion2-avatar-orbit").forEach((avatar) => retrigger(avatar, "motion2-avatar-orbit"))
      const pontos = Array.from(document.querySelectorAll("strong")).filter((el) => /^\d+$/.test(texto(el)))
      pontos.slice(0,16).forEach((el) => retrigger(el, "motion2-score-pop"))
      agendarScan()
    }

    const toque = (event: Event) => {
      const alvo = event.target instanceof Element ? event.target.closest("button,[role='button'],a") : null
      if (!alvo) return
      const rotulo = texto(alvo)
      if (/confirmar|concluir|enviar|salvar|instalar|atualizar/i.test(rotulo) && "vibrate" in navigator) navigator.vibrate(10)
    }

    window.addEventListener("santa-luzia:manual-sync", sincronizou)
    window.addEventListener("santa-luzia:server-sync", sincronizou)
    document.addEventListener("pointerup", toque, { passive:true })

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (scanPendente.current != null) window.cancelAnimationFrame(scanPendente.current)
      scanPendente.current = null
      window.removeEventListener("santa-luzia:manual-sync", sincronizou)
      window.removeEventListener("santa-luzia:server-sync", sincronizou)
      document.removeEventListener("pointerup", toque)
    }
  }, [ativo, pathname])

  return <style>{CSS}</style>
}
