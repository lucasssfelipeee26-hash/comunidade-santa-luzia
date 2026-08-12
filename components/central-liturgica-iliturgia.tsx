"use client"

import { useMemo, useState } from "react"
import {
  BookOpenText,
  ChevronLeft,
  Church,
  Clock3,
  Grid3X3,
  ListTree,
  Menu,
  MoonStar,
  MoreHorizontal,
  ScrollText,
  Search,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react"
import { AcervoLiturgicoOffline } from "@/components/acervo-liturgico-offline"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"
import { santoDoDia } from "@/lib/santo-do-dia"

type Modulo = "hoje" | "oficio" | "liturgia" | "missal" | "mais"
type Tela = {
  id: string
  titulo: string
  categoria?: string
  busca?: string
  tipo?: "liturgia" | "acervo"
}

const horas: Tela[] = [
  { id: "invitatorio", titulo: "Invitatório", categoria: "oficio", busca: "Invitatório" },
  { id: "oficio-leituras", titulo: "Ofício das Leituras", categoria: "oficio", busca: "Ofício das Leituras" },
  { id: "laudes", titulo: "Laudes", categoria: "oficio", busca: "Laudes" },
  { id: "terca", titulo: "Hora Terça", categoria: "oficio", busca: "Terça" },
  { id: "sexta", titulo: "Hora Sexta", categoria: "oficio", busca: "Sexta" },
  { id: "nona", titulo: "Hora Nona", categoria: "oficio", busca: "Nona" },
  { id: "vesperas", titulo: "Vésperas", categoria: "oficio", busca: "Vésperas" },
  { id: "completas", titulo: "Completas", categoria: "oficio", busca: "Completas" },
  { id: "vigilia", titulo: "Vigília", categoria: "oficio", busca: "Vigília" },
]

const missal: Tela[] = [
  { id: "ordinario", titulo: "Ordinário da Missa", categoria: "missal", busca: "Ordinário" },
  { id: "prefacios", titulo: "Prefácios", categoria: "missal", busca: "Prefácio" },
  { id: "eucaristicas", titulo: "Orações Eucarísticas", categoria: "missal", busca: "Oração Eucarística" },
  { id: "proprio", titulo: "Próprio", categoria: "missal", busca: "Próprio" },
  { id: "comum", titulo: "Comuns", categoria: "missal", busca: "Comum" },
]

const mais: Tela[] = [
  { id: "evangelho", titulo: "Evangelho e Lectio Divina", categoria: "evangelho", busca: "" },
  { id: "lecionario", titulo: "Lecionário", categoria: "lecionario", busca: "" },
  { id: "rosario", titulo: "Santo Rosário", categoria: "rosario", busca: "" },
  { id: "salterio", titulo: "Saltério", categoria: "salterio", busca: "" },
  { id: "catequeses", titulo: "Catequeses", categoria: "catequeses", busca: "" },
  { id: "comentarios", titulo: "Comentários", categoria: "comentarios", busca: "" },
  { id: "oracoes", titulo: "Orações", categoria: "geral", busca: "oração" },
  { id: "indice", titulo: "Índice Geral", categoria: "oficio", busca: "" },
]

function IconeHora({ id }: { id: string }) {
  if (id === "laudes") return <Sunrise className="size-5" />
  if (["terca", "sexta", "nona"].includes(id)) return <Sun className="size-5" />
  if (id === "vesperas") return <Sunset className="size-5" />
  if (id === "completas") return <MoonStar className="size-5" />
  if (id === "invitatorio") return <Church className="size-5" />
  return <BookOpenText className="size-5" />
}

function ListaModulo({ itens, abrir }: { itens: Tela[]; abrir: (t: Tela) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#6f5a43]/30 bg-[#f7edcf]">
      {itens.map((item, i) => (
        <button
          key={item.id}
          onClick={() => abrir(item)}
          className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-[#eadbb4] ${i ? "border-t border-[#806b50]/20" : ""}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center text-[#6e4d31]"><IconeHora id={item.id} /></span>
          <span className="font-serif text-xl font-semibold italic text-[#5b3d29]">{item.titulo}</span>
        </button>
      ))}
    </div>
  )
}

export function CentralLiturgicaILiturgia() {
  const [modulo, setModulo] = useState<Modulo>("hoje")
  const [tela, setTela] = useState<Tela | null>(null)
  const santo = useMemo(() => santoDoDia(new Date()), [])
  const dataCompleta = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date()),
    [],
  )

  if (tela) {
    return (
      <section className="min-h-[78vh] bg-[#f2e6c6] pb-24">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#715b40]/30 bg-[#62412d] px-3 py-3 text-[#fff4d7] shadow-sm">
          <button onClick={() => setTela(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="Voltar">
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="font-serif text-xl font-semibold">{tela.titulo}</h1>
        </div>
        <div className="mx-auto max-w-4xl p-3 sm:p-5">
          {tela.tipo === "liturgia" ? (
            <LiturgiaDiaria />
          ) : (
            <AcervoLiturgicoOffline categoriaInicial={tela.categoria} buscaInicial={tela.busca} embutido titulo={tela.titulo} />
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-[82vh] overflow-hidden rounded-2xl border border-[#745a3d]/30 bg-[#efe2bf] pb-20 shadow-sm">
      <header className="bg-[#62412d] px-4 py-4 text-[#fff5dc] shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Menu className="size-6" />
            <div>
              <h1 className="font-serif text-2xl font-bold">iLiturgia</h1>
              <p className="text-[11px] capitalize text-[#e9d6ad]">{dataCompleta}</p>
            </div>
          </div>
          <Church className="size-7 text-[#f1d28a]" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-3 sm:p-5">
        {modulo === "hoje" && (
          <div className="space-y-4">
            {santo ? (
              <button
                type="button"
                onClick={() => setTela({ id: "santo-hoje", titulo: santo.nome, categoria: "oficio", busca: santo.chave })}
                className="grid w-full grid-cols-[110px_1fr] overflow-hidden rounded-xl border border-[#80694d]/35 bg-[#f8edcf] text-left shadow-sm sm:grid-cols-[150px_1fr]"
              >
                <div className="relative min-h-[155px] bg-[#d8c49a]">
                  <img src={santo.imagem} alt={santo.nome} className="absolute inset-0 size-full object-cover" onError={(e) => { e.currentTarget.style.display = "none" }} />
                </div>
                <div className="flex flex-col justify-center p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Santo do dia</p>
                  <h2 className="mt-1 font-serif text-2xl font-bold text-[#583b28] sm:text-3xl">{santo.nome}</h2>
                  {santo.subtitulo && <p className="mt-1 text-sm italic text-[#705c47]">{santo.subtitulo}</p>}
                  <p className="mt-3 text-xs font-semibold text-[#7d5e37]">Abrir próprio do dia</p>
                </div>
              </button>
            ) : (
              <div className="rounded-xl border border-[#80694d]/35 bg-[#f8edcf] p-4">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#997026]">Hoje</p>
                <p className="mt-1 font-serif text-xl font-semibold text-[#583b28]">Calendário litúrgico do dia</p>
              </div>
            )}

            <button onClick={() => setTela({ id: "liturgia-hoje", titulo: "Liturgia diária", tipo: "liturgia" })} className="flex w-full items-center gap-4 rounded-xl border border-[#80694d]/35 bg-[#f8edcf] p-4 text-left shadow-sm">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#68452f] text-[#f8e6b8]"><Church className="size-5" /></span>
              <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#997026]">Liturgia do dia</p><h3 className="font-serif text-xl font-bold text-[#583b28]">Leituras e Evangelho</h3></div>
            </button>

            <div>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[.16em] text-[#8d6a35]">Liturgia das Horas</p>
              <ListaModulo itens={horas.slice(0, 8)} abrir={setTela} />
            </div>
          </div>
        )}

        {modulo === "oficio" && <ListaModulo itens={horas} abrir={setTela} />}

        {modulo === "liturgia" && (
          <div className="space-y-3">
            <button onClick={() => setTela({ id: "liturgia", titulo: "Liturgia diária", tipo: "liturgia" })} className="flex w-full items-center gap-4 rounded-xl border border-[#80694d]/35 bg-[#f8edcf] p-4 text-left">
              <Church className="size-6 text-[#68452f]" /><span className="font-serif text-xl font-semibold italic text-[#583b28]">Liturgia diária</span>
            </button>
            <ListaModulo itens={[
              { id: "leituras", titulo: "Leituras", categoria: "lecionario", busca: "" },
              { id: "evangelho", titulo: "Evangelho", categoria: "evangelho", busca: "" },
              { id: "propria", titulo: "Leitura própria", categoria: "lecionario", busca: "Próprio" },
            ]} abrir={setTela} />
          </div>
        )}

        {modulo === "missal" && <ListaModulo itens={missal} abrir={setTela} />}
        {modulo === "mais" && <ListaModulo itens={mais} abrir={setTela} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[920px] grid-cols-5 border-t border-[#5b412d]/30 bg-[#62412d] text-[#e8d7b3] shadow-[0_-4px_12px_rgba(0,0,0,.12)] sm:rounded-t-2xl">
        {([
          ["hoje", "Hoje", Church],
          ["oficio", "Ofício", Clock3],
          ["liturgia", "Liturgia", BookOpenText],
          ["missal", "Missal", ScrollText],
          ["mais", "Mais", MoreHorizontal],
        ] as const).map(([id, label, I]) => (
          <button key={id} onClick={() => setModulo(id)} className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold ${modulo === id ? "bg-[#765239] text-[#fff1c9]" : ""}`}>
            <I className="size-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  )
}
