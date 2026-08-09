import { MapPin, Clock, Church } from "lucide-react"
import { site, enderecoCompleto } from "@/lib/site"

export function Contato() {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <h3 className="font-serif text-2xl text-primary">Endereço e como chegar</h3>
        </div>
        <address className="not-italic leading-relaxed text-foreground/90">
          999, {site.endereco.rua}
          <br />
          Bairro {site.endereco.bairro}
          <br />
          {site.endereco.cidade} — {site.endereco.estado}
          <br />
          CEP {site.endereco.cep}
        </address>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <MapPin className="size-4" aria-hidden="true" />
          Ver no mapa
        </a>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
            <Clock className="size-5" aria-hidden="true" />
          </span>
          <h3 className="font-serif text-2xl text-primary">Horários das Missas</h3>
        </div>
        <ul className="space-y-3">
          {site.missas.map((m) => (
            <li
              key={m.dia}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <Church className="size-5 text-primary" aria-hidden="true" />
                <span className="font-medium text-foreground">{m.dia}</span>
                <span className="text-sm text-muted-foreground">{m.descricao}</span>
              </span>
              <span className="font-serif text-xl font-semibold text-primary">{m.horario}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
