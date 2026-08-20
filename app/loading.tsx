export default function Loading() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-[#eadde0] bg-white shadow-sm">
            <span className="size-7 animate-spin rounded-full border-[3px] border-[#eadde0] border-t-[#713044]" />
          </span>
          <div>
            <p className="font-serif text-xl font-semibold text-[#713044]">Santa Luzia</p>
            <p className="mt-1 text-xs text-[#756a6d]">Preparando sua experiência…</p>
          </div>
        </div>

        <div className="motion2-loading-skeleton mt-7 hidden space-y-3" aria-hidden="true">
          <div className="motion2-shimmer h-20 rounded-[22px]" />
          <div className="grid grid-cols-3 gap-2">
            <div className="motion2-shimmer h-28 rounded-[20px]" />
            <div className="motion2-shimmer h-32 rounded-[20px]" />
            <div className="motion2-shimmer h-28 rounded-[20px]" />
          </div>
          <div className="motion2-shimmer h-14 rounded-[18px]" />
          <div className="motion2-shimmer h-14 rounded-[18px]" />
        </div>

        <style>{`
          .motion2-enabled .motion2-loading-skeleton { display: block; }
          .motion2-enabled [aria-busy='true'] > div > div:first-child { animation: motion2LoadingHeader 360ms cubic-bezier(.22,.8,.24,1) both; }
          @keyframes motion2LoadingHeader { from { opacity:.3; transform:translateY(8px) } to { opacity:1; transform:none } }
          @media (prefers-reduced-motion: reduce) { .motion2-enabled [aria-busy='true'] > div > div:first-child { animation:none; } }
        `}</style>
      </div>
    </main>
  )
}
