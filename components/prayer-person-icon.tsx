import { ProfileDoorIcon } from "@/components/profile-door-icon"

// Mantemos o nome por compatibilidade com telas antigas. Visualmente, o perfil
// passa a usar a pessoa entrando pela porta, em loop leve conforme a Motion 12.
export function PrayerPersonIcon({ className = "size-6" }: { className?: string }) {
  return <ProfileDoorIcon className={className} animated loop direction="enter" />
}
