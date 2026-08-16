"use client"

export function MobilePolishRuntime() {
  return (
    <style>{`
      @media (max-width: 640px) {
        button, a, input, select, textarea { touch-action: manipulation; }
        input, select, textarea { font-size: 16px; }
      }
    `}</style>
  )
}
