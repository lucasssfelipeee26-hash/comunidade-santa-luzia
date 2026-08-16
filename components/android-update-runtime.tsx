"use client"

import { useCallback, useEffect, useState } from "react"
import useSWR from "swr"
import { ArrowDownToLine, CheckCircle2, Download, RefreshCw, ShieldCheck, Sparkles, WifiOff, X } from "lucide-react"
import { Capacitor } from "@capacitor/core"

type AndroidRelease = {
  available: boolean
  versionCode: number
  versionName: string
  publishedAt?: string
  required: boolean
  highlights: string[]
  downloadUrl: string
  apkSize: number
  apkSha256: string
}

type StatusResponse = { ok: boolean; android?: AndroidRelease }
type AuthResponse = { sessao?: { usuario?: { tipo?: string; status?: string } } | null }

const DISPENSADA_KEY = "santa-luzia:android-update-dispensada"
const EVENTO_STATUS = "santa-luzia:app-status"
const fetcher = (url: string) => fetch(url, { cache: "no-store", credentials: "same-origin" }).then((r) => r.ok ? r.json() : null)

function versaoDispensada(versionCode: number) {
  try {
    const salvo = JSON.parse(localStorage.getItem(DISPENSADA_KEY) || "null") as { versionCode?: number; em?: number } | null
    return salvo?.versionCode === versionCode && Date.now() - Number(salvo.em || 0) < 24 * 60 * 60 * 1000
  } catch { return false }
}

export function AndroidUpdateRuntime() {
  const { data: auth } = useSWR<AuthResponse>("/api/auth/me", fetcher, { refreshInterval: 8_000, revalidateOnFocus: true, revalidateOnReconnect: true })
  const usuario = auth?.sessao?.usuario
  const acessoLiberado = Boolean(usuario && (usuario.tipo === "moderador" || usuario.status === "aprovado"))
  const [release, setRelease] = useState<AndroidRelease | null>(null)
  const [aberta, setAberta] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [offline, setOffline] = useState(false)
  const [percentual, setPercentual] = useState(0)
  const [baixados, setBaixados] = useState(0)
  const [total, setTotal] = useState(0)
  const [etapa, setEtapa] = useState<"idle" | "downloading" | "verifying" | "permission" | "installing" | "error">("idle")
  const [erro, setErro] = useState("")
  const [atualizadorInterno, setAtualizadorInterno] = useState(false)

  const avaliar = useCallback(async (android?: AndroidRelease) => {
    if (!acessoLiberado || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      setRelease(null); setAberta(false); return
    }
    if (!navigator.onLine) { setOffline(true); return }
    setOffline(false)
    try {
      let candidato = android
      if (!candidato) {
        const response = await fetch("/api/app/status", { cache: "no-store", credentials: "same-origin" })
        if (!response.ok) return
        const status = (await response.json()) as StatusResponse
        candidato = status.ok ? status.android : undefined
      }
      if (!candidato?.available) return
      const { App } = await import("@capacitor/app")
      const info = await App.getInfo()
      const buildInstalado = Number.parseInt(info.build, 10)
      if (!Number.isFinite(buildInstalado) || candidato.versionCode <= buildInstalado) { setRelease(null); return }
      setRelease(candidato)
      setAberta(candidato.required || !versaoDispensada(candidato.versionCode))
    } catch {
      // Reavalia na próxima sincronização, foco ou reconexão.
    }
  }, [acessoLiberado])

  useEffect(() => {
    setAtualizadorInterno(Capacitor.isPluginAvailable("AppUpdater"))
    if (!acessoLiberado) { setRelease(null); setAberta(false); return }
    const aoStatus = (event: Event) => { const status = (event as CustomEvent<StatusResponse>).detail; void avaliar(status?.android) }
    const aoVoltar = () => void avaliar()
    const aoFicarOffline = () => setOffline(true)
    window.addEventListener(EVENTO_STATUS, aoStatus)
    window.addEventListener("online", aoVoltar)
    window.addEventListener("offline", aoFicarOffline)
    void avaliar()
    return () => {
      window.removeEventListener(EVENTO_STATUS, aoStatus)
      window.removeEventListener("online", aoVoltar)
      window.removeEventListener("offline", aoFicarOffline)
    }
  }, [acessoLiberado, avaliar])

  async function baixarAtualizacao() {
    if (!release || !navigator.onLine) { setOffline(true); return }
    setBaixando(true); setErro(""); setEtapa("downloading"); setPercentual(0); setBaixados(0); setTotal(release.apkSize)
    try {
      if (!Capacitor.isPluginAvailable("AppUpdater")) {
        const { Browser } = await import("@capacitor/browser")
        await Browser.open({ url: release.downloadUrl, presentationStyle: "popover" })
        setEtapa("idle")
        return
      }
      if (!release.apkSha256 || !release.apkSize) throw new Error("O servidor ainda não publicou a verificação de segurança desta versão.")
      const { AppUpdater } = await import("@/lib/native-app-updater")
      const listener = await AppUpdater.addListener("downloadProgress", (progresso) => {
        setEtapa(progresso.stage); setPercentual(Math.max(0, Math.min(100, progresso.percent || 0))); setBaixados(progresso.downloaded || 0); setTotal(progresso.total || release.apkSize)
      })
      try {
        await AppUpdater.downloadAndInstall({ url: release.downloadUrl, fileName: `Santa-Luzia-${release.versionName}.apk`, expectedSha256: release.apkSha256, expectedSize: release.apkSize })
        setEtapa("installing"); setPercentual(100)
      } finally { await listener.remove() }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir a atualização."); setEtapa("error")
    } finally { setBaixando(false) }
  }

  function deixarParaDepois() {
    if (!release || release.required) return
    localStorage.setItem(DISPENSADA_KEY, JSON.stringify({ versionCode: release.versionCode, em: Date.now() }))
    setAberta(false)
  }

  if (!acessoLiberado || !release) return null

  if (!aberta) return <button type="button" onClick={() => setAberta(true)} className="fixed bottom-24 right-3 z-[90] flex items-center gap-2 rounded-full border border-[#d8c8b0] bg-[#fffdf9]/95 px-4 py-2.5 text-xs font-bold text-[#683044] shadow-[0_12px_35px_rgba(64,23,31,.16)]"><Download className="size-4" /> Atualização {release.versionName}</button>

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#160b0e]/48 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="android-update-title" data-no-pull-refresh>
      <section className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] border border-white/60 bg-[#fffdf8] shadow-2xl sm:rounded-[32px]">
        {!release.required && <button type="button" aria-label="Fechar atualização" onClick={deixarParaDepois} className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-[#6f6064] shadow-sm"><X className="size-5" /></button>}
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,#5f2939_0%,#7b3a4c_65%,#9c8452_100%)] px-6 pb-7 pt-8 text-white">
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg"><Sparkles className="size-7 text-[#f4ddb0]" /></span>
          <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[.22em] text-[#f4ddb0]">Atualização disponível</p>
          <h2 id="android-update-title" className="relative mt-1 font-serif text-3xl font-semibold">Santa Luzia {release.versionName}</h2>
          <p className="relative mt-2 text-sm leading-6 text-white/85">Instala por cima do aplicativo atual, sem apagar seus dados ou sua sessão.</p>
        </div>
        <div className="space-y-4 p-6">
          <ul className="space-y-2.5">{release.highlights.slice(0, 4).map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-[#4d4345]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#557265]" /><span>{item}</span></li>)}</ul>
          {offline && <div className="flex items-start gap-3 rounded-2xl border border-[#d9c9b9] bg-[#f8f3ed] p-3 text-sm text-[#62575a]"><WifiOff className="mt-0.5 size-5 shrink-0" /> Conecte o aparelho à internet para baixar a atualização.</div>}
          {(baixando || etapa === "installing" || etapa === "error") && <div className="rounded-2xl border border-[#e2d6ca] bg-white p-4 shadow-sm" aria-live="polite">{etapa !== "error" ? <><div className="flex items-center justify-between gap-3 text-xs font-bold text-[#62575a]"><span>{etapa === "verifying" ? "Verificando segurança…" : etapa === "permission" ? "Aguardando autorização do Android…" : etapa === "installing" ? "Pronto para instalar" : "Baixando dentro do aplicativo…"}</span><span>{percentual}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eadfd9]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#713044,#9c8452)] transition-[width] duration-300" style={{ width: `${percentual}%` }} /></div>{total > 0 && etapa === "downloading" && <p className="mt-2 text-[11px] text-[#756a6d]">{(baixados / 1024 / 1024).toFixed(1)} MB de {(total / 1024 / 1024).toFixed(1)} MB</p>}{etapa === "permission" && <p className="mt-2 text-[11px] leading-5 text-[#756a6d]">Ative “Permitir desta fonte” e volte ao aplicativo.</p>}{etapa === "installing" && <p className="mt-2 text-[11px] leading-5 text-[#756a6d]">Confirme a instalação na tela do Android.</p>}</> : <p className="text-sm leading-5 text-[#8a2436]">{erro}</p>}</div>}
          <button type="button" onClick={baixarAtualizacao} disabled={baixando || offline} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#713044] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(113,48,68,.20)] disabled:opacity-55">{baixando ? <RefreshCw className="size-5 animate-spin" /> : <ArrowDownToLine className="size-5" />}{baixando ? "Atualizando…" : etapa === "error" ? "Tentar novamente" : atualizadorInterno ? "Baixar e instalar no app" : "Abrir atualização"}</button>
          {!atualizadorInterno && <p className="rounded-2xl bg-[#f8f3ed] p-3 text-center text-[11px] leading-5 text-[#62575a]">Esta instalação antiga ainda precisa abrir o endereço da atualização. Depois desta correção, as próximas instalações serão feitas dentro do aplicativo.</p>}
          {!release.required && <button type="button" onClick={deixarParaDepois} className="w-full py-1 text-sm font-semibold text-[#756a6d]">Lembrar depois</button>}
          <div className="flex gap-2 border-t border-[#e9dfd8] pt-4 text-[11px] leading-5 text-[#756a6d]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#557265]" /><p>O aviso só aparece após o login de um moderador ou membro aprovado.</p></div>
        </div>
      </section>
    </div>
  )
}
