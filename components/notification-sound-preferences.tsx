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
    setMsg(ok ? "Preferência de notificação salva neste aparelho." : "Não foi possível salvar a preferência.")
  }

  async function ouvir(preview?: string, id?: string) {
    audioAtual.current?.pause()
    if (!preview) return
    const audio = new Audio(preview)
    audio.volume = 0.7
    audioAtual.current = audio
    setTocando(id || null)
    audio.onended = () => setTocando(null)
    try { await audio.play() }
    catch { setMsg("Não foi possível reproduzir a prévia neste aparelho.") }
    finally { if (audio.paused) setTocando(null) }
  }

  return (
    <div className="mt-5 rounded-2xl border border-accent/35 bg-white/75 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BellRing className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold text-primary">Som das notificações</h3>
          <p className="mt-1 text-sm text-muted-foreground">Os botões e interações ficam silenciosos. Escolha apenas como os avisos do celular devem tocar.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {NOTIFICATION_SOUND_OPTIONS.map((item) => {
              const selecionado = prefs.notificationSound === item.value
              return (
                <div key={item.value} className={`flex min-h-20 items-center gap-2 rounded-2xl border p-2 transition ${selecionado ? "border-primary bg-primary/[0.06] ring-2 ring-primary/10" : "border-border bg-white hover:border-primary/35"}`}>
                  <button type="button" className="min-w-0 flex-1 px-2 py-1 text-left" onClick={() => salvar({ ...prefs, notificationSound: item.value })}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">{selecionado ? <Check className="size-4 text-primary" /> : item.value === "none" ? <VolumeX className="size-4 text-muted-foreground" /> : <BellRing className="size-4 text-muted-foreground" />}{item.label}</span>
                    <span className="mt-1 block text-xs leading-4 text-muted-foreground">{item.description}</span>
                  </button>
                  {item.preview && <button type="button" onClick={() => ouvir(item.preview, item.value)} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-primary shadow-sm" aria-label={`Ouvir ${item.label}`}><Play className={`size-4 ${tocando === item.value ? "animate-pulse" : ""}`} /></button>}
                </div>
              )
            })}
          </div>
          <div className="mt-3">
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-white px-4 text-sm font-medium">
              <Vibrate className="size-4 text-primary" /><input type="checkbox" checked={prefs.notificationVibration} onChange={(e) => salvar({ ...prefs, notificationVibration: e.target.checked })} /> Vibrar junto com a notificação
            </label>
          </div>
          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
