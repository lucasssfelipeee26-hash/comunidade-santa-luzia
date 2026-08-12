export type UiSoundKey = "soft" | "bell" | "wood" | "sparkle" | "click" | "custom" | "none"
export type FeedbackSoundKey = "success" | "sparkle" | "bell" | "soft" | "none"
export type ErrorSoundKey = "error" | "wood" | "soft" | "none"
export type NotificationSoundKey = "santa" | "bells" | "chime" | "soft" | "none"

export type SoundPreferences = {
  uiSound: UiSoundKey
  uiVolume: number
  successSound: FeedbackSoundKey
  errorSound: ErrorSoundKey
  notificationSound: NotificationSoundKey
  notificationVibration: boolean
  customUiDataUrl?: string | null
  customUiName?: string | null
}

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  uiSound: "soft",
  uiVolume: 0.22,
  successSound: "success",
  errorSound: "error",
  notificationSound: "santa",
  notificationVibration: true,
  customUiDataUrl: null,
  customUiName: null,
}

export const UI_SOUND_OPTIONS: { value: UiSoundKey; label: string; description: string }[] = [
  { value: "soft", label: "Toque suave", description: "Discreto para uso diário" },
  { value: "bell", label: "Sino curto", description: "Som leve de sino" },
  { value: "wood", label: "Madeira", description: "Clique seco e macio" },
  { value: "sparkle", label: "Brilho", description: "Toque claro e moderno" },
  { value: "click", label: "Clique", description: "Resposta rápida e curta" },
  { value: "custom", label: "Meu som", description: "Áudio escolhido neste aparelho" },
  { value: "none", label: "Sem som", description: "Botões silenciosos" },
]

export const SUCCESS_SOUND_OPTIONS: { value: FeedbackSoundKey; label: string }[] = [
  { value: "success", label: "Confirmação" },
  { value: "sparkle", label: "Brilho" },
  { value: "bell", label: "Sino" },
  { value: "soft", label: "Suave" },
  { value: "none", label: "Sem som" },
]

export const ERROR_SOUND_OPTIONS: { value: ErrorSoundKey; label: string }[] = [
  { value: "error", label: "Aviso" },
  { value: "wood", label: "Madeira" },
  { value: "soft", label: "Suave" },
  { value: "none", label: "Sem som" },
]

export const NOTIFICATION_SOUND_OPTIONS: { value: NotificationSoundKey; label: string; file?: string }[] = [
  { value: "santa", label: "Santa Luzia", file: "santa_luzia_notification.wav" },
  { value: "bells", label: "Sinos", file: "santa_luzia_bells.wav" },
  { value: "chime", label: "Carrilhão", file: "santa_luzia_chime.wav" },
  { value: "soft", label: "Suave", file: "santa_luzia_soft.wav" },
  { value: "none", label: "Sem som" },
]

export const UI_SOUND_FILES: Partial<Record<Exclude<UiSoundKey, "custom" | "none">, string>> = {
  soft: "/sounds/ui-soft.wav",
  bell: "/sounds/ui-bell.wav",
  wood: "/sounds/ui-wood.wav",
  sparkle: "/sounds/ui-sparkle.wav",
  click: "/sounds/ui-click.wav",
}

export const FEEDBACK_SOUND_FILES: Record<Exclude<FeedbackSoundKey, "none">, string> = {
  success: "/sounds/ui-success.wav",
  sparkle: "/sounds/ui-sparkle.wav",
  bell: "/sounds/ui-bell.wav",
  soft: "/sounds/ui-soft.wav",
}

export const ERROR_SOUND_FILES: Record<Exclude<ErrorSoundKey, "none">, string> = {
  error: "/sounds/ui-error.wav",
  wood: "/sounds/ui-wood.wav",
  soft: "/sounds/ui-soft.wav",
}

export const SOUND_PREFERENCES_EVENT = "santa-luzia:sound-preferences"
export const APP_FEEDBACK_EVENT = "santa-luzia:feedback"

function clampVolume(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SOUND_PREFERENCES.uiVolume
  return Math.min(0.8, Math.max(0, n))
}

export function soundStorageKey(userId?: string | null) {
  return `santa-luzia:sounds:${userId || "visitante"}`
}

export function loadSoundPreferences(userId?: string | null): SoundPreferences {
  if (typeof window === "undefined") return DEFAULT_SOUND_PREFERENCES
  try {
    const raw = window.localStorage.getItem(soundStorageKey(userId))
    if (!raw) return DEFAULT_SOUND_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<SoundPreferences>
    return {
      ...DEFAULT_SOUND_PREFERENCES,
      ...parsed,
      uiVolume: clampVolume(parsed.uiVolume),
    }
  } catch {
    return DEFAULT_SOUND_PREFERENCES
  }
}

export function saveSoundPreferences(userId: string | null | undefined, preferences: SoundPreferences) {
  if (typeof window === "undefined") return false
  const normalized: SoundPreferences = { ...preferences, uiVolume: clampVolume(preferences.uiVolume) }
  try {
    window.localStorage.setItem(soundStorageKey(userId), JSON.stringify(normalized))
    window.dispatchEvent(new CustomEvent(SOUND_PREFERENCES_EVENT, { detail: { userId, preferences: normalized } }))
    return true
  } catch {
    return false
  }
}

export function resetSoundPreferences(userId?: string | null) {
  if (typeof window === "undefined") return
  try { window.localStorage.removeItem(soundStorageKey(userId)) } catch {}
  window.dispatchEvent(new CustomEvent(SOUND_PREFERENCES_EVENT, { detail: { userId, preferences: DEFAULT_SOUND_PREFERENCES } }))
}

export function emitAppFeedback(kind: "success" | "error") {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(APP_FEEDBACK_EVENT, { detail: { kind } }))
}

export function notificationSoundFile(key: NotificationSoundKey) {
  return NOTIFICATION_SOUND_OPTIONS.find((item) => item.value === key)?.file
}

export function notificationChannelId(key: NotificationSoundKey, vibration: boolean) {
  return `santa_luzia_${key}_${vibration ? "v" : "nv"}_v1`
}

export function notificationChannelName(key: NotificationSoundKey) {
  const label = NOTIFICATION_SOUND_OPTIONS.find((item) => item.value === key)?.label || "Santa Luzia"
  return `Alertas Santa Luzia · ${label}`
}
