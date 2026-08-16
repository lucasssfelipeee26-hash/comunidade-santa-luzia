"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { BellRing, Check, Play, Vibrate, VolumeX } from "lucide-react"
import { NOTIFICATION_SOUND_OPTIONS, loadSoundPreferences, saveSoundPreferences, type SoundPreferences } from "@/lib/sound-preferences"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())
type Sessao = { sessao?: { usuario?: { id?: string } } | null }

export function NotificationSoundPreferences() {
  const { data } = useSWR<Sessao>("/api/auth/me", fetcher, { revalidateOnFocus: false })
  const userId = data?.sessao?.usuario?.id || null
  const [prefs, setPrefs] = useState<SoundPreferences>(() => loadSoundPreferences(null))
  const [msg, setMsg] = useState("")
  const [tocando, setTocando] = useState<string | null>(null)
  const audioAtual = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { setPrefs(loadSoundPreferences(userId)) }, [userId])
  useEffect(() => () => { audioAtual.current?.pause() }, [])

  function salvar(next: SoundPreferences) {
    setPrefs(next)
    const ok = saveSoundPreferences(userId, next)
    setMsg(ok ? "Preferência salva." : "Não foi possível salvar.")
  }

  async function ouvir(preview?: string, id?: string) {
    audioAtual.current?.pause()
    if (!preview) return
    const audio = new Audio(preview)
    audio.volume = 0.7
    audioAtual.current = audio
    setTocando(id || null)
    audio.onended = () => setTocando(null)
    try { await audio.play() } catch { setMsg("Não foi possível reproduzir a prévia.") }
    finally { if (audio.paused) setTocando(null) }
  }

  return (
    <div className="mt-3 rounded-2xl border border-border/75 bg-white/75 p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><BellRing className="size-4" /></span>
        <div className="min-w-0 flex-1"><h3 className="font-serif text-base font-semibold text-primary">Som das notificações</h3><p className="text-[11px] leading-4 text-muted-foreground">Escolha o toque usado pelos avisos do celular.</p></div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {NOTIFICATION_SOUND_OPTIONS.map((item) => {
          const selecionado = prefs.notificationSound === item.value
          return (
            <div key={item.value} className={`flex min-w-0 items-center gap-1 rounded-xl border p-1.5 ${selecionado ? "border-primary/35 bg-primary/[.045]" : "border-border bg-white"}`}>
              <button type="button" className="min-w-0 flex-1 px-1 py-1 text-left" onClick={() => salvar({ ...prefs, notificationSound: item.value })}>
                <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-foreground">{selecionado ? <Check className="size-3.5 shrink-0 text-primary" /> : item.value === "none" ? <VolumeX className="size-3.5 shrink-0 text-muted-foreground" /> : <BellRing className="size-3.5 shrink-0 text-muted-foreground" />}<span className="truncate">{item.label}</span></span>
              </button>
              {item.preview && <button type="button" onClick={() => ouvir(item.preview, item.value)} className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-primary" aria-label={`Ouvir ${item.label}`}><Play className={`size-3 ${tocando === item.value ? "animate-pulse" : ""}`} /></button>}
            </div>
          )
        })}
      </div>
      <label className="mt-2 flex min-h-9 items-center gap-2 rounded-xl border border-border bg-white px-3 text-[11px] font-medium"><Vibrate className="size-3.5 text-primary" /><input type="checkbox" checked={prefs.notificationVibration} onChange={(e) => salvar({ ...prefs, notificationVibration: e.target.checked })} /> Vibrar junto</label>
      {msg && <p className="mt-1.5 text-[10px] text-muted-foreground">{msg}</p>}
    </div>
  )
}
