"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { createPortal } from "react-dom"

export type HighContrastOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type HighContrastSelectProps = {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: HighContrastOption[]
  placeholder?: string
  dialogTitle?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function HighContrastSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Selecione uma opção",
  dialogTitle = "Escolher opção",
  disabled = false,
  required = false,
  className = "",
}: HighContrastSelectProps) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState("")
  const [montado, setMontado] = useState(false)
  const tituloId = useId()
  const botaoRef = useRef<HTMLButtonElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)

  const selecionada = options.find((opcao) => opcao.value === value)
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return options
    return options.filter((opcao) =>
      `${opcao.label} ${opcao.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo),
    )
  }, [busca, options])

  useEffect(() => setMontado(true), [])

  useEffect(() => {
    if (!aberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    setBusca("")
    window.setTimeout(() => fecharRef.current?.focus(), 0)

    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false)
    }
    window.addEventListener("keydown", fecharComEscape)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener("keydown", fecharComEscape)
      window.setTimeout(() => botaoRef.current?.focus(), 0)
    }
  }, [aberto])

  function escolher(opcao: HighContrastOption) {
    if (opcao.disabled) return
    onValueChange(opcao.value)
    setAberto(false)
  }

  const modal = montado && aberto
    ? createPortal(
        <div className="fixed inset-0 z-[140]" data-no-pull-refresh>
          <button
            type="button"
            aria-label="Fechar seletor"
            onClick={() => setAberto(false)}
            className="absolute inset-0 h-full w-full bg-black/65"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className="fixed inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-[#d8cbc5] bg-[#fffdfb] text-[#241a1c] shadow-[0_-18px_60px_rgba(0,0,0,.28)] sm:inset-x-4 sm:bottom-4 sm:rounded-[28px]"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-[#dfd3cd] bg-[#fff8f4] px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#8b2038]">Selecionar</p>
                <h2 id={tituloId} className="truncate text-lg font-bold text-[#241a1c]">{dialogTitle}</h2>
              </div>
              <button
                ref={fecharRef}
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#d8cbc5] bg-white text-[#77182f]"
              >
                <X className="size-5" />
              </button>
            </header>

            {options.length > 8 && (
              <div className="shrink-0 border-b border-[#e5dad5] bg-white p-3">
                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#cfc1bb] bg-white px-3">
                  <Search className="size-4 shrink-0 text-[#6d5e61]" aria-hidden="true" />
                  <span className="sr-only">Buscar opção</span>
                  <input
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Buscar pelo nome"
                    className="min-w-0 flex-1 border-0 bg-white p-0 text-base text-[#241a1c] outline-none placeholder:text-[#75686b]"
                  />
                </label>
              </div>
            )}

            <div
              role="listbox"
              aria-label={dialogTitle}
              className="min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain bg-[#f7f2ef] p-3"
            >
              {filtradas.map((opcao) => {
                const ativa = opcao.value === value
                return (
                  <button
                    key={opcao.value}
                    type="button"
                    role="option"
                    aria-selected={ativa}
                    disabled={opcao.disabled}
                    onClick={() => escolher(opcao)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      ativa
                        ? "border-[#8b2038] bg-[#f8e5ea] text-[#571124] ring-2 ring-[#8b2038]/15"
                        : "border-[#d9cdc7] bg-white text-[#241a1c]"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold leading-5">{opcao.label}</span>
                      {opcao.description && <span className="mt-1 block text-xs leading-4 text-[#65585b]">{opcao.description}</span>}
                    </span>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${ativa ? "border-[#8b2038] bg-[#8b2038] text-white" : "border-[#b9aaa4] bg-white text-transparent"}`}>
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
              {filtradas.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#cfc1bb] bg-white p-5 text-center text-sm font-medium text-[#65585b]">
                  Nenhuma opção encontrada.
                </p>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={botaoRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setAberto(true)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#cfc1bb] bg-white px-3 py-2.5 text-left text-[#241a1c] shadow-sm outline-none transition focus:border-[#8b2038] focus:ring-2 focus:ring-[#8b2038]/15 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${selecionada ? "text-[#241a1c]" : "text-[#65585b]"}`}>
          {selecionada?.label ?? placeholder}
        </span>
        <ChevronDown className="size-5 shrink-0 text-[#68152a]" aria-hidden="true" />
      </button>
      {modal}
    </>
  )
}
