"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { BellRing, Check, RotateCcw, Upload, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { HighContrastSelect } from "@/components/ui/high-contrast-select"
import {
  DEFAULT_SOUND_PREFERENCES,
  ERROR_SOUND_FILES,
  ERROR_SOUND_OPTIONS,
  FEEDBACK_SOUND_FILES,
  NOTIFICATION_SOUND_OPTIONS,
  SUCCESS_SOUND_OPTIONS,
  UI_SOUND_FILES,
  UI_SOUND_OPTIONS,
  loadSoundPreferences,
  notificationSoundFile,
  resetSoundPreferences,
  saveSoundPreferences,
  type SoundPreferences,
} from "@/lib/sound-preferences"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

type Sessao = { sessao?: { usuario?: { id?: string } } | null }

function tocar(src: string | null | undefined, volume = 0.25) {
  if (!src) return
  try {
    const audio = new Audio(src)
    audio.volume = Math.min(0.8, Math.max(0, volume))
    void audio.play().catch(() => undefined)
  } catch {
    // Sem ação: alguns WebViews bloqueiam áudio até a primeira interação.
  }
}

export function SoundPreferencesPanel() {
  const { data } = useSWR<Sessao>("/api/auth/me", fetcher, { revalidateOnFocus: false })
  const userId = data?.sessao?.usuario?.id || null
  const [prefs, setPrefs] = useState<SoundPreferences>(DEFAULT_SOUND_PREFERENCES)
  const [mensagem, setMensagem] = useState("")

  useEffect(() => {
    setPrefs(loadSoundPreferences(userId))
  }, [userId])

  const customLabel = useMemo(() => prefs.customUiName || "Nenhum arquivo escolhido", [prefs.customUiName])

  function atualizar(patch: Partial<SoundPreferences>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    const salvo = saveSoundPreferences(userId, next)
    setMensagem(salvo ? "Preferência salva neste aparelho." : "Não foi possível salvar a preferência neste aparelho.")
  }

  function testarBotao() {
    if (prefs.uiSound === "none") return
    const src = prefs.uiSound === "custom" ? prefs.customUiDataUrl : UI_SOUND_FILES[prefs.uiSound]
    tocar(src, prefs.uiVolume)
  }

  function testarSucesso() {
    if (prefs.successSound === "none") return
    tocar(FEEDBACK_SOUND_FILES[prefs.successSound], prefs.uiVolume)
  }

  function testarErro() {
    if (prefs.errorSound === "none") return
    tocar(ERROR_SOUND_FILES[prefs.errorSound], prefs.uiVolume)
  }

  function testarNotificacao() {
    const file = notificationSoundFile(prefs.notificationSound)
    tocar(file ? `/sounds/${file}` : null, 0.42)
  }

  function arquivoPersonalizado(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("audio/")) {
      setMensagem("Escolha um arquivo de áudio válido.")
      return
    }
    if (file.size > 300 * 1024) {
      setMensagem("O som personalizado deve ter no máximo 300 KB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      atualizar({ customUiDataUrl: String(reader.result), customUiName: file.name, uiSound: "custom" })
      setMensagem("Som personalizado salvo neste aparelho.")
    }
    reader.readAsDataURL(file)
  }

  function restaurar() {
    resetSoundPreferences(userId)
    setPrefs(DEFAULT_SOUND_PREFERENCES)
    setMensagem("Sons restaurados para o padrão.")
  }

  return (
    <section className="mt-5 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-primary">
          <Volume2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-xl font-semibold text-primary">Sons do aplicativo</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cada perfil pode escolher os sons deste aparelho. O som personalizado vale para botões; notificações Android usam os sons já incluídos no app.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border/80 bg-secondary/35 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="som-botoes">Som dos botões</Label>
            <Button type="button" variant="outline" size="sm" onClick={testarBotao} data-sound="off">Testar</Button>
          </div>
          <HighContrastSelect
            id="som-botoes"
            value={prefs.uiSound}
            onValueChange={(value) => atualizar({ uiSound: value as SoundPreferences["uiSound"] })}
            dialogTitle="Som dos botões"
            options={UI_SOUND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Volume</span><span>{Math.round(prefs.uiVolume * 100)}%</span></div>
            <input aria-label="Volume dos sons de interação" type="range" min="0" max="0.8" step="0.05" value={prefs.uiVolume} onChange={(e) => atualizar({ uiVolume: Number(e.target.value) })} className="w-full accent-[#861f35]" />
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-white px-3 py-2.5 text-sm font-medium text-primary">
            <Upload className="size-4" /> Escolher meu som
            <input type="file" accept="audio/*" className="hidden" onChange={arquivoPersonalizado} />
          </label>
          <p className="truncate text-[11px] text-muted-foreground">{customLabel}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/80 bg-secondary/35 p-3.5">
          <div className="flex items-center justify-between gap-2"><Label htmlFor="som-sucesso">Som de confirmação</Label><Button type="button" variant="outline" size="sm" onClick={testarSucesso} data-sound="off">Testar</Button></div>
          <HighContrastSelect
            id="som-sucesso"
            value={prefs.successSound}
            onValueChange={(value) => atualizar({ successSound: value as SoundPreferences["successSound"] })}
            dialogTitle="Som de confirmação"
            options={SUCCESS_SOUND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
          <div className="flex items-center justify-between gap-2 pt-1"><Label htmlFor="som-erro">Som de aviso/erro</Label><Button type="button" variant="outline" size="sm" onClick={testarErro} data-sound="off">Testar</Button></div>
          <HighContrastSelect
            id="som-erro"
            value={prefs.errorSound}
            onValueChange={(value) => atualizar({ errorSound: value as SoundPreferences["errorSound"] })}
            dialogTitle="Som de aviso ou erro"
            options={ERROR_SOUND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-border/80 bg-secondary/35 p-3.5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-foreground">Som das notificações</p><p className="text-xs text-muted-foreground">Usado em Escala, Liturgia, Ranking e outros lembretes.</p></div><Button type="button" variant="outline" size="sm" onClick={testarNotificacao} data-sound="off" disabled={prefs.notificationSound === "none"}><BellRing className="mr-1.5 size-4" />Ouvir</Button></div>
          <div className="grid gap-2 sm:grid-cols-5">
            {NOTIFICATION_SOUND_OPTIONS.map((option) => {
              const active = prefs.notificationSound === option.value
              return <button type="button" key={option.value} data-sound="off" onClick={() => atualizar({ notificationSound: option.value })} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition ${active ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20" : "border-border bg-white text-foreground"}`}>{option.value === "none" ? <VolumeX className="size-4" /> : active ? <Check className="size-4" /> : <Volume2 className="size-4" />}{option.label}</button>
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={prefs.notificationVibration} onChange={(e) => atualizar({ notificationVibration: e.target.checked })} className="size-4 accent-[#861f35]" /> Vibrar junto com as notificações</label>
          <p className="text-[11px] leading-5 text-muted-foreground">Depois de trocar o som de notificação, abra Ranking e Quiz → Avisos e toque em “Ativar / sincronizar” para atualizar os lembretes já agendados.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={restaurar} className="gap-2" data-sound="off"><RotateCcw className="size-4" />Restaurar padrão</Button>
        {mensagem && <span role="status" className="text-xs text-muted-foreground">{mensagem}</span>}
      </div>
    </section>
  )
}
