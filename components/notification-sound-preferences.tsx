"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { BellRing, Vibrate } from "lucide-react"
import { NOTIFICATION_SOUND_OPTIONS, loadSoundPreferences, saveSoundPreferences, type SoundPreferences } from "@/lib/sound-preferences"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())
type Sessao = { sessao?: { usuario?: { id?: string } } | null }

export function NotificationSoundPreferences() {
  const { data } = useSWR<Sessao>("/api/auth/me", fetcher, { revalidateOnFocus: false })
  const userId = data?.sessao?.usuario?.id || null
  const [prefs, setPrefs] = useState<SoundPreferences>(() => loadSoundPreferences(null))
  const [msg, setMsg] = useState("")

  useEffect(() => { setPrefs(loadSoundPreferences(userId)) }, [userId])

  function salvar(next: SoundPreferences) {
    setPrefs(next)
    const ok = saveSoundPreferences(userId, next)
    setMsg(ok ? "Preferência de notificação salva neste aparelho." : "Não foi possível salvar a preferência.")
  }

  return (
    <div className="mt-5 rounded-2xl border border-accent/35 bg-white/75 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BellRing className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold text-primary">Som das notificações</h3>
          <p className="mt-1 text-sm text-muted-foreground">Os botões e interações ficam silenciosos. Escolha apenas como os avisos do celular devem tocar.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Som
              <select className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3" value={prefs.notificationSound} onChange={(e) => salvar({ ...prefs, notificationSound: e.target.value as SoundPreferences["notificationSound"] })}>
                {NOTIFICATION_SOUND_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 text-sm font-medium sm:mt-6">
              <Vibrate className="size-4 text-primary" /><input type="checkbox" checked={prefs.notificationVibration} onChange={(e) => salvar({ ...prefs, notificationVibration: e.target.checked })} /> Vibração
            </label>
          </div>
          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
