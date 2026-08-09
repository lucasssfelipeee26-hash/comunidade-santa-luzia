"use client"

import { Trash2 } from "lucide-react"
import { formatarData, type Registro } from "@/lib/store"

export function RegistroCard({
  titulo,
  icon,
  itens,
  accent,
  vazio,
  onRemover,
}: {
  titulo: string
  icon: React.ReactNode
  itens: Registro[]
  accent: string
  vazio: string
  onRemover?: (registroId: string) => void
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2.5 font-serif text-xl text-primary">
          <span className={`flex size-8 items-center justify-center rounded-full ${accent}`}>{icon}</span>
          {titulo}
        </h3>
        <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {itens.length}
        </span>
      </header>

      <div className="px-5 py-4">
        {itens.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{vazio}</p>
        ) : (
          // Lombada de livro de registro: um filete contínuo com um selo por
          // lançamento, como as entradas de um caderno de sacristia.
          <ol className="relative space-y-5 border-l border-border pl-5">
            {itens.map((r) => (
              <li key={r.id} className="group relative">
                <span
                  className={`absolute top-0.5 -left-[25px] size-3 rounded-full ring-4 ring-card ${accent}`}
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-sm font-semibold tracking-wide text-foreground">
                    {formatarData(r.data)}
                  </p>
                  {onRemover && (
                    <button
                      type="button"
                      onClick={() => onRemover(r.id)}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label="Remover registro"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-foreground/85">{r.descricao}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
