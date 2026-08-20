"use client"

import { useEffect, useMemo, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { ArrowDownToLine, CheckCircle2, Layers3, RefreshCw, ShieldCheck, Sparkles, Trophy, WandSparkles, X } from "lucide-react"

const REPOSITORIO = "lucasssfelipeee26-hash/comunidade-santa-luzia"
const MANIFESTO_URL = `https://raw.githubusercontent.com/${REPOSITORIO}/main/config/android-release.json`
const APK_URL = `https://github.com/${REPOSITORIO}/releases/latest/download/santa-luzia.apk`
const APK_FALLBACK_URL = "https://comunidade-santa-luzia-production.up.railway.app/api/app/android/download"
const MOTION_BUILD = 19
const DISPENSADA = "santa-luzia:motion2:dispensada"

type Manifesto = {
  versionCode: number
  versionName: string
  apkSize: number
  apkSha256: string
  highlights?: string[]
}

type Etapa = "idle" | "downloading" | "verifying" | "permission" | "installing" | "error"

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

function manifestoValido(valor: unknown): valor is Manifesto {
  if (!valor || typeof valor !== "object") return false
  const item = valor as Partial<Manifesto>
  return Number.isInteger(item.versionCode) && Number(item.versionCode) >= MOTION_BUILD
    && typeof item.versionName === "string" && item.versionName.length > 0
    && Number.isInteger(item.apkSize) && Number(item.apkSize) > 0
    && typeof item.apkSha256 === "string" && /^[a-f0-9]{64}$/i.test(item.apkSha256)
}

export function Motion2UpdateBanner() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null)
  const [aberto, setAberto] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>("idle")
  const [percentual, setPercentual] = useState(0)
  const [erro, setErro] = useState("")

  const destaques = useMemo(() => manifesto?.highlights?.slice(0, 4) || [
    "Transições suaves entre telas e navegação mais fluida",
    "Ranking com pódio, troféu e perfis animados",
    "Formações, botões, modais e notificações com microanimações",
    "Nova linguagem visual com movimento e acessibilidade",
  ], [manifesto])

  useEffect(() => {
    if (!androidNativo()) return
    let cancelado = false
    const verificar = async () => {
      try {
        const { App } = await import("@capacitor/app")
        const info = await App.getInfo()
        const build = Number.parseInt(info.build, 10)
        if (!Number.isFinite(build) || build < 18 || build >= MOTION_BUILD) return

        const response = await fetch(`${MANIFESTO_URL}?motion=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } })
        const json = await response.json() as unknown
        if (!response.ok || !manifestoValido(json)) return
        if (cancelado || (json as Manifesto).versionCode <= build) return

        setManifesto(json as Manifesto)
        let dispensada = false
        try { dispensada = sessionStorage.getItem(DISPENSADA) === String((json as Manifesto).versionCode) } catch {}
        if (!dispensada) setAberto(true)
      } catch {}
    }
    void verificar()
    const timer = window.setInterval(verificar, 5 * 60_000)
    const aoVoltar = () => { if (document.visibilityState === "visible") void verificar() }
    document.addEventListener("visibilitychange", aoVoltar)
    return () => { cancelado = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", aoVoltar) }
  }, [])

  useEffect(() => {
    if (aberto && manifesto) document.body.dataset.motionUpdateBanner = "true"
    else delete document.body.dataset.motionUpdateBanner
    return () => { delete document.body.dataset.motionUpdateBanner }
  }, [aberto, manifesto])

  function depois() {
    if (manifesto) {
      try { sessionStorage.setItem(DISPENSADA, String(manifesto.versionCode)) } catch {}
    }
    setAberto(false)
  }

  async function instalar() {
    if (!manifesto || baixando) return
    setBaixando(true)
    setErro("")
    setEtapa("downloading")
    setPercentual(0)
    try {
      const { AppUpdater } = await import("@/lib/native-app-updater")
      const listener = await AppUpdater.addListener("downloadProgress", (evento) => {
        setEtapa(evento.stage)
        setPercentual(Math.max(0, Math.min(100, evento.percent || 0)))
      })
      try {
        let instalado = false
        let ultimaFalha: unknown = null
        for (const url of [APK_URL, APK_FALLBACK_URL]) {
          try {
            await AppUpdater.downloadAndInstall({
              url,
              fileName: `Santa-Luzia-Motion-2-code${manifesto.versionCode}.apk`,
              expectedSize: manifesto.apkSize,
              expectedSha256: manifesto.apkSha256.toLowerCase(),
            })
            instalado = true
            break
          } catch (falha) {
            ultimaFalha = falha
          }
        }
        if (!instalado) {
          if (ultimaFalha instanceof Error) throw ultimaFalha
          throw new Error("Não foi possível obter a atualização pelas origens oficiais.")
        }
        setEtapa("installing")
        setPercentual(100)
      } finally {
        await listener.remove()
      }
    } catch (falha) {
      setEtapa("error")
      setErro(falha instanceof Error ? falha.message : "Não foi possível instalar o Motion 2.0.")
    } finally {
      setBaixando(false)
    }
  }

  if (!manifesto) return null

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="fixed bottom-24 right-3 z-[125] flex items-center gap-2 rounded-full border border-[#d7bb70]/60 bg-[linear-gradient(135deg,#641e34,#8b3c55)] px-4 py-2.5 text-xs font-black text-white shadow-[0_14px_40px_rgba(83,28,45,.28)]">
        <Sparkles className="size-4 text-[#f4d98d]" /> Motion 2.0
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[140] grid place-items-end bg-[#160b0e]/58 p-0 backdrop-blur-[3px] sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="motion2-title" data-no-pull-refresh>
      <section className="motion2-update-card relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[34px] border border-white/15 bg-[#fffdf8] shadow-[0_30px_90px_rgba(22,11,14,.36)] sm:rounded-[34px]">
        <button type="button" onClick={depois} aria-label="Atualizar depois" className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/15 bg-black/15 text-white backdrop-blur-md"><X className="size-5" /></button>

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_15%,rgba(238,204,111,.34),transparent_28%),linear-gradient(145deg,#4d1427_0%,#7b2f48_56%,#a58442_120%)] px-6 pb-8 pt-8 text-white">
          <div className="motion2-update-orb absolute -right-12 -top-12 size-40 rounded-full border border-white/10" />
          <div className="motion2-update-orb motion2-update-orb-delay absolute -bottom-20 -left-8 size-44 rounded-full border border-[#f0d692]/15" />
          <span className="relative grid size-16 place-items-center rounded-[22px] border border-white/20 bg-white/10 shadow-[0_14px_34px_rgba(0,0,0,.18)] backdrop-blur-md"><WandSparkles className="size-8 text-[#f6dda0]" /></span>
          <p className="relative mt-5 text-[10px] font-black uppercase tracking-[.24em] text-[#f3d98f]">Uma nova experiência</p>
          <h2 id="motion2-title" className="relative mt-1 font-serif text-[2rem] font-semibold leading-tight">Santa Luzia<br /><span className="text-[#f4d98d]">Motion 2.0</span></h2>
          <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/82">Mais movimento, profundidade e resposta em cada toque — sem sacrificar velocidade nem a identidade do aplicativo.</p>
          <div className="relative mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-white/75"><ShieldCheck className="size-4 text-[#f4d98d]" /> Atualização oficial · code {manifesto.versionCode}</div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[#eadfd5] bg-white p-3 text-center shadow-sm"><Trophy className="mx-auto size-5 text-[#a7843b]" /><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#6b565b]">Ranking vivo</p></div>
            <div className="rounded-2xl border border-[#eadfd5] bg-white p-3 text-center shadow-sm"><Layers3 className="mx-auto size-5 text-[#713044]" /><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#6b565b]">Transições</p></div>
            <div className="rounded-2xl border border-[#eadfd5] bg-white p-3 text-center shadow-sm"><Sparkles className="mx-auto size-5 text-[#9c8452]" /><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#6b565b]">Microefeitos</p></div>
          </div>

          <ul className="space-y-2.5">
            {destaques.map((item) => <li key={item} className="flex items-start gap-2.5 rounded-2xl bg-[#faf6f1] px-3 py-2.5 text-xs leading-5 text-[#514649]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#61786d]" /><span>{item}</span></li>)}
          </ul>

          {(baixando || etapa === "error" || etapa === "installing") && <div className="rounded-2xl border border-[#e5d8cc] bg-white p-4 shadow-sm" aria-live="polite">
            {etapa === "error" ? <p className="text-xs leading-5 text-[#982d45]">{erro}</p> : <>
              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-[#62575a]"><span>{etapa === "verifying" ? "Verificando segurança…" : etapa === "permission" ? "Aguardando autorização…" : etapa === "installing" ? "Pronto para instalar" : "Baixando Motion 2.0…"}</span><span>{percentual}%</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#ede4de]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#713044,#b29049)] transition-[width] duration-300" style={{ width: `${percentual}%` }} /></div>
            </>}
          </div>}

          <button type="button" onClick={instalar} disabled={baixando} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#641e34,#803a50)] px-5 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(100,30,52,.22)] disabled:opacity-60">
            {baixando ? <RefreshCw className="size-5 animate-spin" /> : <ArrowDownToLine className="size-5" />}
            {etapa === "error" ? "Tentar novamente" : baixando ? "Preparando atualização…" : "Atualizar para Motion 2.0"}
          </button>
          <button type="button" onClick={depois} className="w-full py-1 text-xs font-bold text-[#756a6d]">Atualizar depois</button>
          <p className="text-center text-[10px] leading-4 text-[#827477]">O download tenta primeiro o GitHub Releases; instalações antigas do code 18 podem usar a ponte oficial do servidor. Tamanho, SHA-256, pacote, versão e assinatura continuam obrigatórios.</p>
        </div>
      </section>
      <style>{`
        .motion2-update-card { animation: motion2UpdateIn 420ms cubic-bezier(.2,.9,.22,1.08) both; }
        .motion2-update-orb { animation: motion2Orb 5s ease-in-out infinite; }
        .motion2-update-orb-delay { animation-delay:-2.4s; }
        @keyframes motion2UpdateIn { from { opacity:0; transform:translateY(34px) scale(.97) } to { opacity:1; transform:none } }
        @keyframes motion2Orb { 0%,100% { transform:translate3d(0,0,0) scale(1) } 50% { transform:translate3d(-8px,9px,0) scale(1.08) } }
        @media (prefers-reduced-motion: reduce) { .motion2-update-card,.motion2-update-orb { animation:none !important } }
      `}</style>
    </div>
  )
}
