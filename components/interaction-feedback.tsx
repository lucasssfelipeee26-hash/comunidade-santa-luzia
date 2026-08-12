"use client"

import { useEffect, useRef } from "react"
import useSWR from "swr"
import {
  APP_FEEDBACK_EVENT,
  ERROR_SOUND_FILES,
  FEEDBACK_SOUND_FILES,
  SOUND_PREFERENCES_EVENT,
  UI_SOUND_FILES,
  loadSoundPreferences,
  type SoundPreferences,
} from "@/lib/sound-preferences"

const INTERACTIVE_SELECTOR =
  "button, a[href], [role='button'], input[type='button'], input[type='submit'], input[type='reset']"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

type Sessao = { sessao?: { usuario?: { id?: string } } | null }

function elementoInterativo(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const elemento = target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
  if (!elemento) return null
  if (elemento.closest("[data-sound='off']")) return null
  if (elemento.matches(":disabled, [aria-disabled='true']")) return null
  return elemento
}

function sourceForUi(prefs: SoundPreferences) {
  if (prefs.uiSound === "none") return null
  if (prefs.uiSound === "custom") return prefs.customUiDataUrl || UI_SOUND_FILES.soft
  return UI_SOUND_FILES[prefs.uiSound] || UI_SOUND_FILES.soft
}

function sourceForFeedback(prefs: SoundPreferences, kind: "success" | "error") {
  if (kind === "success") {
    if (prefs.successSound === "none") return null
    return FEEDBACK_SOUND_FILES[prefs.successSound]
  }
  if (prefs.errorSound === "none") return null
  return ERROR_SOUND_FILES[prefs.errorSound]
}

export function InteractionFeedback() {
  const { data } = useSWR<Sessao>("/api/auth/me", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  })
  const userId = data?.sessao?.usuario?.id || null
  const prefsRef = useRef<SoundPreferences | null>(null)
  const poolRef = useRef<HTMLAudioElement[]>([])
  const poolIndex = useRef(0)

  useEffect(() => {
    prefsRef.current = loadSoundPreferences(userId)
  }, [userId])

  useEffect(() => {
    function recarregar() {
      prefsRef.current = loadSoundPreferences(userId)
    }

    function tocar(src: string | null | undefined, volume?: number) {
      if (!src) return
      const prefs = prefsRef.current || loadSoundPreferences(userId)
      if (!poolRef.current.length) {
        poolRef.current = Array.from({ length: 3 }, () => new Audio())
      }
      const audio = poolRef.current[poolIndex.current]
      poolIndex.current = (poolIndex.current + 1) % poolRef.current.length
      try {
        audio.pause()
        if (audio.src !== new URL(src, window.location.href).href) audio.src = src
        audio.currentTime = 0
        audio.volume = Math.min(0.8, Math.max(0, volume ?? prefs.uiVolume))
        void audio.play().catch(() => undefined)
      } catch {
        // O Android pode bloquear áudio até a primeira interação do usuário.
      }
    }

    function pointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button > 0) return
      if (!elementoInterativo(event.target)) return
      const prefs = prefsRef.current || loadSoundPreferences(userId)
      tocar(sourceForUi(prefs), prefs.uiVolume)
    }

    function keyDown(event: KeyboardEvent) {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return
      if (!elementoInterativo(event.target)) return
      const prefs = prefsRef.current || loadSoundPreferences(userId)
      tocar(sourceForUi(prefs), prefs.uiVolume)
    }

    function feedback(event: Event) {
      const detail = (event as CustomEvent<{ kind?: "success" | "error" }>).detail
      if (detail?.kind !== "success" && detail?.kind !== "error") return
      const prefs = prefsRef.current || loadSoundPreferences(userId)
      tocar(sourceForFeedback(prefs, detail.kind), Math.min(0.6, prefs.uiVolume + 0.08))
    }

    window.addEventListener(SOUND_PREFERENCES_EVENT, recarregar)
    window.addEventListener(APP_FEEDBACK_EVENT, feedback)
    document.addEventListener("pointerdown", pointerDown, { passive: true, capture: true })
    document.addEventListener("keydown", keyDown, { capture: true })

    return () => {
      window.removeEventListener(SOUND_PREFERENCES_EVENT, recarregar)
      window.removeEventListener(APP_FEEDBACK_EVENT, feedback)
      document.removeEventListener("pointerdown", pointerDown, true)
      document.removeEventListener("keydown", keyDown, true)
      for (const audio of poolRef.current) {
        audio.pause()
        audio.removeAttribute("src")
      }
      poolRef.current = []
    }
  }, [userId])

  return null
}
