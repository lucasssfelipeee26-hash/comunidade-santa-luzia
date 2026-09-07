"use client"

import { memo, useMemo } from "react"

type Rank = 1 | 2 | 3

const VISUAL: Record<Rank, { main: string; light: string; dark: string; label: string }> = {
  1: { main: "#d4af37", light: "#f7dc7a", dark: "#8a6b20", label: "Troféu de 1º lugar" },
  2: { main: "#c7c9cf", light: "#f1f2f5", dark: "#777b84", label: "Troféu de 2º lugar" },
  3: { main: "#c98247", light: "#efb27f", dark: "#81502d", label: "Troféu de 3º lugar" },
}

export const RankingTrophy = memo(function RankingTrophy({ rank }: { rank: Rank }) {
  const visual = useMemo(() => VISUAL[rank], [rank])
  const gradientId = `sl-ranking-trophy-${rank}`

  return (
    <span
      className={`sl-ranking-trophy sl-ranking-trophy--${rank}`}
      data-ranking-trophy-react="true"
      data-icon="ranking-trophy"
      data-rank={rank}
      role="img"
      aria-label={visual.label}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={visual.light} />
            <stop offset=".48" stopColor={visual.main} />
            <stop offset="1" stopColor={visual.dark} />
          </linearGradient>
        </defs>
        <g fill={`url(#${gradientId})`}>
          <path d="M18 8h28v8c0 13-5 22-11 26v7h7v5H22v-5h7v-7c-6-4-11-13-11-26z" />
          <path d="M18 13H9v7c0 9 5 15 12 17v-6c-4-2-6-6-6-11v-1h3zm28 0h9v7c0 9-5 15-12 17v-6c4-2 6-6 6-11v-1h-3z" />
          <rect x="17" y="54" width="30" height="5" rx="2.5" />
        </g>
        <path d="M25 13h14c-1 10-3 17-7 21-4-4-6-11-7-21z" fill={visual.light} opacity=".3" />
      </svg>
    </span>
  )
})

RankingTrophy.displayName = "RankingTrophy"
