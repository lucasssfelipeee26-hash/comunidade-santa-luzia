export default function Loading() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-5 py-12" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="relative flex size-14 items-center justify-center rounded-2xl border border-[#eadde0] bg-white shadow-sm">
          <span className="size-7 animate-spin rounded-full border-[3px] border-[#eadde0] border-t-[#713044]" />
        </span>
        <div>
          <p className="font-serif text-xl font-semibold text-[#713044]">Santa Luzia</p>
          <p className="mt-1 text-xs text-[#756a6d]">Carregando com segurança…</p>
        </div>
      </div>
    </main>
  )
}
