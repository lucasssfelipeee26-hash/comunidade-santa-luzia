"use client"

export function MobilePolishRuntime() {
  return (
    <style>{`
      ::selection { background: #e8d07a !important; color: #4a0c18 !important; }
      input::selection, textarea::selection { background: #d4af37 !important; color: #351018 !important; }
      input, textarea, select { caret-color: #7b1326; }
      input:focus, textarea:focus, select:focus { -webkit-text-fill-color: currentColor; }
      .area-restrita-shell input, .area-restrita-shell textarea, .area-restrita-shell select {
        background-color: #fff !important;
        color: #302326 !important;
        -webkit-text-fill-color: #302326 !important;
      }
      .area-restrita-shell input:disabled, .area-restrita-shell textarea:disabled, .area-restrita-shell select:disabled {
        opacity: .72;
        background-color: #f7f3ef !important;
      }
      @media (max-width: 640px) {
        button, a, input, select, textarea { touch-action: manipulation; }
        input, select, textarea { font-size: 16px; }
      }
    `}</style>
  )
}
