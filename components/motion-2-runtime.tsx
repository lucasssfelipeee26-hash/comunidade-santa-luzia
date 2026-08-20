"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"

const BUILD_MOTION_2 = 19

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

function texto(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim()
}

function retrigger(el: Element | null, classe: string) {
  if (!(el instanceof HTMLElement)) return
  el.classList.remove(classe)
  void el.offsetWidth
  el.classList.add(classe)
}

function prepararPodio() {
  const titulos = Array.from(document.querySelectorAll("h1,h2,h3,p"))
  const titulo = titulos.find((el) => texto(el).includes("Pódio da equipe"))
  const secao = titulo?.closest("section")
  if (!(secao instanceof HTMLElement)) return

  secao.classList.add("motion2-podium")
  const grade = Array.from(secao.querySelectorAll(":scope > div"))
    .find((el) => el.classList.contains("grid") && el.classList.contains("grid-cols-3"))
  if (!(grade instanceof HTMLElement)) return

  Array.from(grade.children).forEach((card, indice) => {
    if (!(card instanceof HTMLElement)) return
    card.classList.add("motion2-podium-card", `motion2-place-${indice + 1}`)
    card.style.setProperty("--motion-delay", `${90 + indice * 90}ms`)
    const avatar = card.querySelector("[data-slot='avatar']") || card.querySelector("img")?.parentElement
    if (avatar instanceof HTMLElement) avatar.classList.add("motion2-avatar-orbit")
  })

  const trophy = Array.from(secao.querySelectorAll("svg")).find((svg) => svg.closest("div")?.contains(titulo || null))
    || secao.querySelector("svg")
  if (trophy instanceof SVGElement) trophy.classList.add("motion2-trophy")
}

function prepararFormacao(pathname: string) {
  if (!pathname.includes("formacao")) return
  const candidatos = Array.from(document.querySelectorAll("main section, main article, main > div > div"))
    .filter((el) => el instanceof HTMLElement && /rounded|border|shadow/.test(el.className))
    .slice(0, 24)
  candidatos.forEach((el, indice) => {
    const card = el as HTMLElement
    card.classList.add("motion2-formation-card")
    card.style.setProperty("--motion-delay", `${Math.min(indice, 8) * 55}ms`)
  })
}

function prepararCardsGerais() {
  const main = document.querySelector("main")
  if (!main) return
  const filhos = Array.from(main.children).filter((el) => el instanceof HTMLElement).slice(0, 14)
  filhos.forEach((el, indice) => {
    const item = el as HTMLElement
    item.classList.add("motion2-section-enter")
    item.style.setProperty("--motion-delay", `${Math.min(indice, 7) * 42}ms`)
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
  prepararCardsGerais()
  prepararPodio()
  prepararFormacao(pathname)
  prepararDialogos()
  prepararNotificacoes()
}

const CSS = String.raw`
  .motion2-enabled { --motion2-ease: cubic-bezier(.22,.8,.24,1); --motion2-spring: cubic-bezier(.2,.95,.22,1.18); }
  .motion2-enabled main.motion2-page-enter { animation: motion2PageIn 260ms var(--motion2-ease) both; }
  .motion2-enabled .motion2-section-enter { animation: motion2SectionIn 360ms var(--motion2-ease) both; animation-delay: var(--motion-delay,0ms); }

  .motion2-enabled :is(button,a,[role='button']):not([aria-disabled='true']) { transition: transform 150ms var(--motion2-spring), box-shadow 180ms ease, background-color 180ms ease, color 180ms ease, border-color 180ms ease, opacity 180ms ease; -webkit-tap-highlight-color: transparent; }
  .motion2-enabled :is(button,a,[role='button']):not([aria-disabled='true']):active { transform: scale(.972); }
  .motion2-enabled .mobile-app-bottom-nav { animation: motion2NavRise 360ms var(--motion2-ease) both; }
  .motion2-enabled .mobile-app-bottom-nav [aria-current='page'] > span { animation: motion2NavActive 320ms var(--motion2-spring) both; box-shadow: 0 8px 20px rgba(123,19,38,.24); }
  .motion2-enabled .mobile-app-bottom-nav [aria-current='page'] svg { animation: motion2IconPop 300ms var(--motion2-spring) both; }

  .motion2-enabled .motion2-santa-logo { transform-style: preserve-3d; will-change: transform; }
  .motion2-enabled .motion2-santa-logo.motion2-logo-spin { animation: motion2LogoSpin 720ms cubic-bezier(.2,.72,.2,1) both; }
  .motion2-enabled .motion2-santa-logo::after { content:""; position:absolute; inset:-2px; border-radius:999px; pointer-events:none; background: conic-gradient(from 220deg,transparent 0 42%,rgba(255,226,137,.9) 49%,transparent 56% 100%); opacity:0; }
  .motion2-enabled .motion2-santa-logo.motion2-logo-spin::after { animation: motion2Halo 720ms ease both; }

  .motion2-enabled .motion2-podium { position:relative; overflow:hidden; perspective:900px; background: radial-gradient(circle at 50% 0%,rgba(218,181,88,.13),transparent 42%),rgba(255,255,255,.72); }
  .motion2-enabled .motion2-podium::after { content:""; position:absolute; inset:-45% -20%; pointer-events:none; background:linear-gradient(110deg,transparent 40%,rgba(255,244,203,.34) 49%,transparent 58%); transform:translateX(-60%) rotate(8deg); animation:motion2PodiumSweep 4.8s ease-in-out 1s infinite; }
  .motion2-enabled .motion2-podium-card { isolation:isolate; overflow:hidden; transform-style:preserve-3d; animation:motion2PodiumCardIn 560ms var(--motion2-spring) both; animation-delay:var(--motion-delay,0ms); }
  .motion2-enabled .motion2-podium-card::before { content:""; position:absolute; inset:-1px; border-radius:inherit; padding:1.5px; pointer-events:none; background:conic-gradient(from var(--motion-angle,0deg), transparent, var(--motion-metal,#d4af37), transparent 34%, var(--motion-metal,#d4af37), transparent 66%); -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; animation:motion2BorderOrbit 4s linear infinite; opacity:.72; }
  .motion2-enabled .motion2-place-1 { --motion-metal:#d4af37; box-shadow:0 15px 36px rgba(172,128,28,.18); }
  .motion2-enabled .motion2-place-2 { --motion-metal:#b9bec7; box-shadow:0 12px 30px rgba(99,108,122,.14); }
  .motion2-enabled .motion2-place-3 { --motion-metal:#b98255; box-shadow:0 12px 30px rgba(140,87,48,.14); }
  .motion2-enabled .motion2-avatar-orbit { transform-style:preserve-3d; animation:motion2AvatarTurn 760ms cubic-bezier(.2,.82,.24,1) both; animation-delay:calc(var(--motion-delay,0ms) + 120ms); }
  .motion2-enabled .motion2-trophy { transform-box:fill-box; transform-origin:center; filter:drop-shadow(0 5px 5px rgba(113,75,12,.25)); animation:motion2Trophy3d 3.6s ease-in-out infinite; }
  .motion2-enabled .motion2-score-pop { animation:motion2ScorePop 420ms var(--motion2-spring) both; }

  .motion2-enabled .motion2-formation-card { animation:motion2FormationIn 420ms var(--motion2-ease) both; animation-delay:var(--motion-delay,0ms); transform-origin:50% 100%; }
  .motion2-enabled .motion2-formation-card:hover { transform:translateY(-2px); }
  .motion2-enabled .motion2-dialog { animation:motion2Backdrop 180ms ease both; }
  .motion2-enabled .motion2-dialog > :is(section,div):not([aria-hidden='true']) { animation:motion2SheetIn 330ms var(--motion2-spring) both; }
  .motion2-enabled .motion2-live-region > * { animation:motion2NoticeIn 320ms var(--motion2-ease) both; }

  .motion2-enabled [aria-busy='true'] .animate-spin { animation-duration:.8s; filter:drop-shadow(0 2px 4px rgba(113,48,68,.12)); }
  .motion2-enabled .motion2-shimmer { position:relative; overflow:hidden; background:#f1ebe8; }
  .motion2-enabled .motion2-shimmer::after { content:""; position:absolute; inset:0; background:linear-gradient(100deg,transparent 25%,rgba(255,255,255,.72) 45%,transparent 65%); transform:translateX(-100%); animation:motion2Shimmer 1.35s ease-in-out infinite; }

  .motion2-enabled body[data-motion-update-banner='true'] [aria-labelledby='android-update-github-title'] { visibility:hidden !important; pointer-events:none !important; }

  @keyframes motion2PageIn { from{opacity:.25;transform:translate3d(0,10px,0) scale(.995)} to{opacity:1;transform:none} }
  @keyframes motion2SectionIn { from{opacity:0;transform:translate3d(0,14px,0)} to{opacity:1;transform:none} }
  @keyframes motion2NavRise { from{opacity:0;transform:translate3d(0,16px,0) scale(.97)} to{opacity:1;transform:none} }
  @keyframes motion2NavActive { 0%{transform:translateY(2px) scale(.9)} 65%{transform:translateY(-2px) scale(1.08)} 100%{transform:translateY(-1px) scale(1.04)} }
  @keyframes motion2IconPop { 0%{transform:scale(.75) rotate(-8deg)} 70%{transform:scale(1.12) rotate(3deg)} 100%{transform:none} }
  @keyframes motion2LogoSpin { 0%{transform:perspective(500px) rotateY(0deg) scale(.92)} 45%{transform:perspective(500px) rotateY(190deg) scale(1.05)} 100%{transform:perspective(500px) rotateY(360deg) scale(1)} }
  @keyframes motion2Halo { 0%{opacity:0;transform:rotate(0)} 40%{opacity:1} 100%{opacity:0;transform:rotate(360deg)} }
  @keyframes motion2PodiumSweep { 0%,64%{transform:translateX(-65%) rotate(8deg);opacity:0} 72%{opacity:1} 88%,100%{transform:translateX(70%) rotate(8deg);opacity:0} }
  @keyframes motion2PodiumCardIn { from{opacity:0;transform:perspective(700px) translateY(18px) rotateX(7deg) scale(.94)} to{opacity:1;transform:none} }
  @keyframes motion2AvatarTurn { 0%{transform:perspective(480px) rotateY(-180deg) scale(.82);opacity:.35} 65%{transform:perspective(480px) rotateY(12deg) scale(1.06);opacity:1} 100%{transform:none} }
  @keyframes motion2Trophy3d { 0%,100%{transform:perspective(400px) rotateY(-10deg) rotateZ(-2deg) translateY(0)} 50%{transform:perspective(400px) rotateY(13deg) rotateZ(2deg) translateY(-3px)} }
  @keyframes motion2BorderOrbit { to{--motion-angle:360deg} }
  @keyframes motion2ScorePop { 0%{transform:scale(.88);opacity:.4} 65%{transform:scale(1.12);opacity:1} 100%{transform:none} }
  @keyframes motion2FormationIn { from{opacity:0;transform:translateY(16px) scale(.985)} to{opacity:1;transform:none} }
  @keyframes motion2Backdrop { from{background-color:rgba(22,11,14,0)} to{} }
  @keyframes motion2SheetIn { from{opacity:.3;transform:translateY(28px) scale(.98)} to{opacity:1;transform:none} }
  @keyframes motion2NoticeIn { from{opacity:0;transform:translateY(-10px) scale(.98)} to{opacity:1;transform:none} }
  @keyframes motion2Shimmer { to{transform:translateX(100%)} }

  @property --motion-angle { syntax:'<angle>'; initial-value:0deg; inherits:false; }

  @media (prefers-reduced-motion: reduce) {
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
      if (!cancelado) setAtivo(Number.isFinite(build) && build >= BUILD_MOTION_2)
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
    if (main instanceof HTMLElement) {
      main.classList.remove("motion2-page-enter")
      void main.offsetWidth
      main.classList.add("motion2-page-enter")
    }
    const logo = document.querySelector("img[alt='Santa Luzia']")?.parentElement
    retrigger(logo, "motion2-logo-spin")

    observerRef.current?.disconnect()
    observerRef.current = new MutationObserver(agendarScan)
    observerRef.current.observe(document.body, { childList: true, subtree: true })

    const sincronizou = () => {
      retrigger(document.querySelector("img[alt='Santa Luzia']")?.parentElement || null, "motion2-logo-spin")
      const ranking = Array.from(document.querySelectorAll("strong")).filter((el) => /^\d+$/.test(texto(el)))
      ranking.slice(0, 16).forEach((el) => retrigger(el, "motion2-score-pop"))
      agendarScan()
    }
    const toque = (event: Event) => {
      const alvo = event.target instanceof Element ? event.target.closest("button,[role='button'],a") : null
      if (!alvo) return
      const rotulo = texto(alvo)
      if (/confirmar|concluir|enviar|salvar|instalar|atualizar/i.test(rotulo) && "vibrate" in navigator) {
        navigator.vibrate(10)
      }
    }
    window.addEventListener("santa-luzia:manual-sync", sincronizou)
    window.addEventListener("santa-luzia:server-sync", sincronizou)
    document.addEventListener("pointerup", toque, { passive: true })

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
