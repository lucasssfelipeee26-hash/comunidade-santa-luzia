import { UserRound } from "lucide-react"

// Nome mantido apenas por compatibilidade com telas antigas. O visual voltou ao
// ícone convencional de pessoa/perfil, sem qualquer animação de entrada ou porta.
export function PrayerPersonIcon({ className = "size-6" }: { className?: string }) {
  return <UserRound className={className} aria-hidden="true" />
}
