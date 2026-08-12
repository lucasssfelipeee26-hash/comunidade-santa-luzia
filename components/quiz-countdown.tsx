"use client"

type QuizCountdownProps = {
  restante: number
  duracao: number
  texto: string
}

export function QuizCountdown({ restante, duracao, texto }: QuizCountdownProps) {
  const total = Math.max(1, duracao)
  const atual = Math.max(0, Math.min(restante, total))
  const raio = 9
  const circunferencia = 2 * Math.PI * raio
  const progresso = atual / total
  const offset = circunferencia * (1 - progresso)
  const urgente = atual <= Math.min(20, Math.ceil(total * 0.2))

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 font-mono text-sm font-bold ${
        urgente ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
      }`}
      aria-label={`Tempo restante: ${texto}`}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-6 -rotate-90">
          <circle
            cx="12"
            cy="12"
            r={raio}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            opacity="0.18"
          />
          <circle
            cx="12"
            cy="12"
            r={raio}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        <span className="absolute size-1.5 rounded-full bg-current" />
      </span>
      {texto}
    </span>
  )
}
