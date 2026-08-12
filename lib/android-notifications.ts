import {
  notificationChannelId,
  notificationChannelName,
  notificationSoundFile,
  type SoundPreferences,
} from "@/lib/sound-preferences"

export const DEFAULT_ANDROID_NOTIFICATION_SOUND = "santa_luzia_notification.wav"

export function androidNotificationConfig(preferences: SoundPreferences) {
  const sound = notificationSoundFile(preferences.notificationSound)
  return {
    channelId: notificationChannelId(preferences.notificationSound, preferences.notificationVibration),
    channelName: notificationChannelName(preferences.notificationSound),
    sound,
    vibration: preferences.notificationVibration,
  }
}
