"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDownToLine, CheckCircle2, Download, RefreshCw, ShieldCheck, Sparkles, WifiOff, X } from "lucide-react"
import { Capacitor } from "@capacitor/core"

const REPOSITORIO = "lucasssfelipeee26-hash/comunidade-santa-luzia"
const MANIFESTO_URL = `https://raw.githubusercontent.com/${REPOSITORIO}/main/config/android-release.json`
const APK_URL = `https://github.com/${REPOSITORIO}/releases/latest/download/santa-luzia.apk`
const APK_PONTE_CODE17_URL = "https://comunidade-santa-luzia-production.up.railway.app/api/app/android/download"
const DISPENSADA_KEY = "santa-luzia:android-update-github-dispensada-sessao"
const INTERVALO_VERIFICACAO = 5 * 60_000
const TIMEOUT_MANIFESTO = 8_000

type ManifestoAndroid = {
  versionCode: number
  versionName: string
  publishedAt?: string
  required?: boolean
  apkSize: number
  apkSha256: string
  highlights?: string[]
}

type AndroidRelease = {
  available: true
  versionCode: number
  versionName: string
  publishedAt?: string
  required: boolean
  highlights: string[]
  downloadUrl: string
  apkSize: number
  apkSha256: string
}

function androidNativo() {
  if (typeof window === "undefined") return false
  try {
    if (Capacitor.getPlatform() === "android") return true
    if (document.documentElement.dataset.nativePlatform === "android") return true
    return navigator.userAgent.includes("SantaLuziaAndroid")
  } catch {
    return navigator.userAgent.includes("SantaLuziaAndroid")
  }
}

function versaoDispensada(versionCode: number) {
  try {
    return Number(sessionStorage.getItem(DISPENSADA_KEY) || "0") === versionCode
  } catch {
    return false
  }
}

function manifestoValido(valor: unknown): valor is ManifestoAndroid {
  if (!valor || typeof valor !== "object") return false
  const item = valor as Partial<ManifestoAndroid>
  return Number.isInteger(item.versionCode) && Number(item.versionCode) > 0
    && typeof item.versionName === "string" && item.versionName.trim().length > 0
    && Number.isInteger(item.apkSize) && Number(item.apkSize) > 0
    && typeof item.apkSha256 === "string" && /^[a-f0-9]{64}$/i.test(item.apkSha256)
}

export function AndroidUpdateGithubRuntime() {
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
  const conectadoRef = useRef<boolean | null>(null)
  const buildInstaladoRef = useRef<number | null>(null)
  const consultaEmAndamentoRef = useRef(false)
  const candidatoAtualRef = useRef<number | null>(null)

  const estaConectado = useCallback(() => {
    if (conectadoRef.current !== null) return conectadoRef.current
    return typeof navigator === "undefined" ? true : navigator.onLine
  }, [])

  const obterBuildInstalado = useCallback(async () => {
    if (buildInstaladoRef.current !== null) return buildInstaladoRef.current
    try {
      const { App } = await import("@capacitor/app")
      const info = await App.getInfo()
      const build = Number.parseInt(info.build, 10)
      buildInstaladoRef.current = Number.isFinite(build) ? build : -1
    } catch {
      buildInstaladoRef.current = -1
    }
    return buildInstaladoRef.current ?? -1
  }, [])

  const buscarManifesto = useCallback(async (): Promise<AndroidRelease> => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MANIFESTO)
    try {
      const separador = MANIFESTO_URL.includes("?") ? "&" : "?"
      const response = await fetch(`${MANIFESTO_URL}${separador}update=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status}`)
      const manifesto = await response.json() as unknown
      if (!manifestoValido(manifesto)) throw new Error("Manifesto de atualização inválido")
      return {
        available: true,
        versionCode: manifesto.versionCode,
        versionName: manifesto.versionName,
        publishedAt: manifesto.publishedAt,
        required: Boolean(manifesto.required),
        highlights: Array.isArray(manifesto.highlights) ? manifesto.highlights.filter((item): item is string => typeof item === "string") : [],
        downloadUrl: APK_URL,
        apkSize: manifesto.apkSize,
        apkSha256: manifesto.apkSha256.toLowerCase(),
      }
    } finally {
      window.clearTimeout(timer)
    }
  }, [])

  const avaliar = useCallback(async () => {
    if (!androidNativo()) return
    if (!estaConectado()) {
      setOffline(true)
      return
    }
    if (consultaEmAndamentoRef.current) return

    consultaEmAndamentoRef.current = true
    setOffline(false)
    try {
      const candidato = await buscarManifesto()
      const buildInstalado = await obterBuildInstalado()
      if (buildInstalado < 0) return

      if (candidato.versionCode <= buildInstalado) {
        candidatoAtualRef.current = null
        setRelease(null)
        setAberta(false)
        return
      }

      const novaVersao = candidatoAtualRef.current !== candidato.versionCode
      candidatoAtualRef.current = candidato.versionCode
      setRelease(candidato)
      if (candidato.required || (novaVersao && !versaoDispensada(candidato.versionCode))) setAberta(true)
    } catch {
      // O GitHub é tentado novamente ao reconectar, voltar ao app e no intervalo de segurança.
    } finally {
      consultaEmAndamentoRef.current = false
    }
  }, [buscarManifesto, estaConectado, obterBuildInstalado])

  useEffect(() => {
    if (!androidNativo()) return

    setAtualizadorInterno(Capacitor.isPluginAvailable("AppUpdater"))
    let encerrado = false
    const timers = new Set<number>()
    const listenersNativos: Array<{ remove: () => Promise<void> }> = []

    const reagendar = () => {
      for (const atraso of [0, 1_500, 5_000]) {
        const timer = window.setTimeout(() => {
          timers.delete(timer)
          if (!encerrado) void avaliar()
        }, atraso)
        timers.add(timer)
      }
    }

    const aoOnline = () => {
      conectadoRef.current = true
      setOffline(false)
      reagendar()
    }
    const aoOffline = () => {
      conectadoRef.current = false
      setOffline(true)
    }
    const aoVisibilidade = () => {
      if (document.visibilityState === "visible") reagendar()
    }

    window.addEventListener("online", aoOnline)
    window.addEventListener("offline", aoOffline)
    document.addEventListener("visibilitychange", aoVisibilidade)

    void (async () => {
      try {
        const { Network } = await import("@capacitor/network")
        const status = await Network.getStatus()
        if (encerrado) return
        conectadoRef.current = status.connected
        setOffline(!status.connected)
        if (status.connected) reagendar()
        const handle = await Network.addListener("networkStatusChange", (novoStatus) => {
          if (encerrado) return
          conectadoRef.current = novoStatus.connected
          setOffline(!novoStatus.connected)
          if (novoStatus.connected) reagendar()
        })
        if (encerrado) await handle.remove()
        else listenersNativos.push(handle)
      } catch {
        conectadoRef.current = navigator.onLine
        if (navigator.onLine) reagendar()
      }

      try {
        const { App } = await import("@capacitor/app")
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (!encerrado && isActive) reagendar()
        })
        if (encerrado) await handle.remove()
        else listenersNativos.push(handle)
      } catch {
        // visibilitychange segue como fallback.
      }
    })()

    reagendar()
    const intervalo = window.setInterval(() => {
      if (!encerrado && document.visibilityState === "visible" && estaConectado()) void avaliar()
    }, INTERVALO_VERIFICACAO)

    return () => {
      encerrado = true
      window.clearInterval(intervalo)
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener("online", aoOnline)
      window.removeEventListener("offline", aoOffline)
      document.removeEventListener("visibilitychange", aoVisibilidade)
      listenersNativos.forEach((handle) => { void handle.remove() })
    }
  }, [avaliar, estaConectado])

  async function baixarAtualizacao() {
    if (!release || !estaConectado()) {
      setOffline(true)
      return
    }

    setBaixando(true)
    setErro("")
    setEtapa("downloading")
    setPercentual(0)
    setBaixados(0)
    setTotal(release.apkSize)

    try {
      if (!Capacitor.isPluginAvailable("AppUpdater")) {
        const { Browser } = await import("@capacitor/browser")
        await Browser.open({ url: release.downloadUrl, presentationStyle: "popover" })
        setEtapa("idle")
        return
      }

      const buildInstalado = await obterBuildInstalado()
      const urlsDownload = buildInstalado > 0 && buildInstalado < 18
        ? [APK_PONTE_CODE17_URL]
        : [release.downloadUrl, APK_PONTE_CODE17_URL]

      const { AppUpdater } = await import("@/lib/native-app-updater")
      const listener = await AppUpdater.addListener("downloadProgress", (progresso) => {
        setEtapa(progresso.stage)
        setPercentual(Math.max(0, Math.min(100, progresso.percent || 0)))
        setBaixados(progresso.downloaded || 0)
        setTotal(progresso.total || release.apkSize)
      })

      try {
        let instalado = false
        let ultimaFalha: unknown = null
        for (const urlDownload of urlsDownload) {
          try {
            await AppUpdater.downloadAndInstall({
              url: urlDownload,
              fileName: `Santa-Luzia-${release.versionName}-code${release.versionCode}.apk`,
              expectedSha256: release.apkSha256,
              expectedSize: release.apkSize,
            })
            instalado = true
            break
          } catch (falha) {
            ultimaFalha = falha
          }
        }
        if (!instalado) {
          if (ultimaFalha instanceof Error) throw ultimaFalha
          throw new Error("Não foi possível concluir a atualização pelas origens oficiais.")
        }
        setEtapa("installing")
        setPercentual(100)
      } finally {
        await listener.remove()
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir a atualização.")
      setEtapa("error")
    } finally {
      setBaixando(false)
    }
  }

  function deixarParaDepois() {
    if (!release || release.required) return
    try { sessionStorage.setItem(DISPENSADA_KEY, String(release.versionCode)) } catch {}
    setAberta(false)
  }

  if (!androidNativo() || !release) return null

  if (!aberta) {
    return (
      <button type="button" onClick={() => setAberta(true)} className="fixed bottom-24 right-3 z-[90] flex items-center gap-2 rounded-full border border-[#d8c8b0] bg-[#fffdf9]/95 px-4 py-2.5 text-xs font-bold text-[#683044] shadow-[0_12px_35px_rgba(64,23,31,.16)]">
        <Download className="size-4" /> Atualização {release.versionName}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#160b0e]/48 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="android-update-github-title" data-no-pull-refresh>
      <section className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] border border-white/60 bg-[#fffdf8] shadow-2xl sm:rounded-[32px]">
        {!release.required && <button type="button" aria-label="Fechar atualização" onClick={deixarParaDepois} className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-[#6f6064] shadow-sm"><X className="size-5" /></button>}
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,#5f2939_0%,#7b3a4c_65%,#9c8452_100%)] px-6 pb-7 pt-8 text-white">
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg"><Sparkles className="size-7 text-[#f4ddb0]" /></span>
          <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[.22em] text-[#f4ddb0]">Atualização disponível</p>
          <h2 id="android-update-github-title" className="relative mt-1 font-serif text-3xl font-semibold">Santa Luzia {release.versionName}</h2>
          <p className="relative mt-2 text-sm leading-6 text-white/85">A nova versão foi encontrada diretamente no GitHub e pode ser instalada sem depender do servidor do aplicativo.</p>
        </div>

        <div className="space-y-4 p-6">
          <ul className="space-y-2.5">
            {release.highlights.slice(0, 4).map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-[#4d4345]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#557265]" /><span>{item}</span></li>)}
          </ul>

          {offline && <div className="flex items-start gap-3 rounded-2xl border border-[#d9c9b9] bg-[#f8f3ed] p-3 text-sm text-[#62575a]"><WifiOff className="mt-0.5 size-5 shrink-0" /> Conecte o aparelho à internet. A atualização será verificada diretamente no GitHub assim que a conexão voltar.</div>}

          {(baixando || etapa === "installing" || etapa === "error") && (
            <div className="rounded-2xl border border-[#e2d6ca] bg-white p-4 shadow-sm" aria-live="polite">
              {etapa !== "error" ? <>
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#62575a]"><span>{etapa === "verifying" ? "Verificando segurança…" : etapa === "permission" ? "Aguardando autorização do Android…" : etapa === "installing" ? "Pronto para instalar" : "Baixando atualização…"}</span><span>{percentual}%</span></div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eadfd9]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#713044,#9c8452)] transition-[width] duration-300" style={{ width: `${percentual}%` }} /></div>
                {total > 0 && etapa === "downloading" && <p className="mt-2 text-[11px] text-[#756a6d]">{(baixados / 1024 / 1024).toFixed(1)} MB de {(total / 1024 / 1024).toFixed(1)} MB</p>}
                {etapa === "permission" && <p className="mt-2 text-[11px] leading-5 text-[#756a6d]">Ative “Permitir desta fonte” e volte ao aplicativo.</p>}
                {etapa === "installing" && <p className="mt-2 text-[11px] leading-5 text-[#756a6d]">Confirme a instalação na tela do Android.</p>}
              </> : <p className="text-sm leading-5 text-[#8a2436]">{erro}</p>}
            </div>
          )}

          <button type="button" onClick={baixarAtualizacao} disabled={baixando || offline} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#713044] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(113,48,68,.20)] disabled:opacity-55">
            {baixando ? <RefreshCw className="size-5 animate-spin" /> : <ArrowDownToLine className="size-5" />}
            {baixando ? "Atualizando…" : etapa === "error" ? "Tentar novamente" : atualizadorInterno ? "Baixar e instalar no app" : "Abrir atualização"}
          </button>

          {!atualizadorInterno && <p className="rounded-2xl bg-[#f8f3ed] p-3 text-center text-[11px] leading-5 text-[#62575a]">Esta instalação antiga abrirá o download no navegador. As builds atuais fazem o processo dentro do aplicativo.</p>}
          {!release.required && <button type="button" onClick={deixarParaDepois} className="w-full py-1 text-sm font-semibold text-[#756a6d]">Atualizar depois</button>}

          <div className="flex gap-2 border-t border-[#e9dfd8] pt-4 text-[11px] leading-5 text-[#756a6d]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#557265]" /><p>O code 17 usa uma ponte única pelo servidor oficial para instalar o code 18. As builds compatíveis usam GitHub Releases diretamente e mantêm a ponte oficial apenas como fallback, sempre com validação de tamanho, SHA-256, pacote, versão e assinatura nativa.</p></div>
        </div>
      </section>
    </div>
  )
}
