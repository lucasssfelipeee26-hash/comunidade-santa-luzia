"use client"

import { useEffect, useState } from "react"
import { ArrowDownToLine, CheckCircle2, Loader2, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react"
import { Capacitor } from "@capacitor/core"

type AndroidRelease = {
  available: boolean
  versionName: string
  highlights: string[]
  downloadUrl: string
}

export function AndroidDownloadCard() {
  const [release, setRelease] = useState<AndroidRelease | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [android, setAndroid] = useState(true)
  const [instalado, setInstalado] = useState(false)

  useEffect(() => {
    setInstalado(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android")
    setAndroid(/Android/i.test(navigator.userAgent))
    fetch("/api/app/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => setRelease(status?.android?.available ? status.android : null))
      .catch(() => setRelease(null))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return <div className="flex min-h-52 items-center justify-center rounded-[28px] border border-[#e5d9ca] bg-white"><Loader2 className="size-7 animate-spin text-[#7b1326]" aria-label="Carregando versão" /></div>
  }

  if (instalado) {
    return (
      <div className="rounded-[30px] border border-[#cfe4d9] bg-white p-7 text-center shadow-[0_22px_70px_rgba(72,34,23,.09)]">
        <CheckCircle2 className="mx-auto size-14 text-[#0b6b4b]" />
        <h2 className="mt-4 font-serif text-3xl font-semibold text-[#173d2d]">Aplicativo instalado</h2>
        <p className="mt-2 text-sm leading-6 text-[#665d5f]">Você já está usando o Santa Luzia no Android. As próximas versões aparecerão como atualização dentro do próprio aplicativo.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[30px] border border-[#dfd0bb] bg-white shadow-[0_22px_70px_rgba(72,34,23,.11)]">
      <div className="bg-[linear-gradient(145deg,#073b29,#0b6548)] p-6 text-white sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/12 text-[#f2cf62]"><Smartphone className="size-7" /></span>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#f2cf62]">Aplicativo Android</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold">Santa Luzia {release?.versionName || ""}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-white/78">APK completo para instalar no celular, sem mensalidade e sem taxa de loja.</p>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        {!android && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#e4d3a4] bg-[#fff8e7] p-4 text-sm leading-6 text-[#6b551d]">
            <MonitorSmartphone className="mt-0.5 size-5 shrink-0" /> Abra esta página em um celular Android para instalar o aplicativo.
          </div>
        )}

        {release ? (
          <>
            <ul className="space-y-3">
              {release.highlights.slice(0, 4).map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-5 text-[#4f4745]"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#0b6b4b]" />{item}</li>)}
            </ul>
            <a href={release.downloadUrl} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#7b1326] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(123,19,38,.22)]">
              <ArrowDownToLine className="size-5" /> Baixar APK gratuitamente
            </a>
          </>
        ) : (
          <div className="rounded-2xl border border-[#e2d9d2] bg-[#f8f5f2] p-4 text-sm leading-6 text-[#665d5f]">A primeira versão está sendo preparada. Atualize esta página em alguns instantes.</div>
        )}

        <div className="flex items-start gap-3 border-t border-[#eee4dc] pt-5 text-xs leading-5 text-[#736a6b]">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#0b6b4b]" />
          <p>Na primeira instalação, o Android solicitará autorização para instalar por este navegador. Depois, cada nova versão aparecerá dentro do próprio aplicativo.</p>
        </div>
      </div>
    </div>
  )
}
