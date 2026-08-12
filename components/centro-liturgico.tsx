"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Library,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
} from "lucide-react"
import type { Liturgia } from "@/app/api/liturgia/route"
import { CalendarioLiturgico } from "@/components/calendario-liturgico"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"
import { horasCanonicas, inventarioOffline, misteriosRosario, recursosCentro } from "@/lib/centro-liturgico"

const fetcher = async (url: string) => {
  const resposta = await fetch(url, { cache: "no-store" })
  if (!resposta.ok) return null
  return resposta.json()
}

type Aba = "inicio" | "liturgia" | "horas" | "acervo" | "rosario" | "calendario" | "leitura"

function misterioDoDia() {
  const dia = new Date().getDay()
  if (dia === 1 || dia === 6) return "Gozosos"
  if (dia === 2 || dia === 5) return "Dolorosos"
  if (dia === 4) return "Luminosos"
  return "Gloriosos"
}

function Icone({ id }: { id: string }) {
  if (id === "liturgia") return <BookOpenText className="size-5" />
  if (id === "horas") return <Clock3 className="size-5" />
  if (id === "acervo") return <Database className="size-5" />
  if (id === "calendario") return <CalendarDays className="size-5" />
  if (id === "leitura") return <Settings2 className="size-5" />
  return <Sparkles className="size-5" />
}

export function CentroLiturgico() {
  const [aba, setAba] = useState<Aba>("inicio")
  const [misterio, setMisterio] = useState(misterioDoDia)
  const [indice, setIndice] = useState(0)
  const [aveMarias, setAveMarias] = useState(0)
  const [fonte, setFonte] = useState(17)
  const [noturno, setNoturno] = useState(false)
  const { data } = useSWR<Liturgia | null>("/api/liturgia-local", fetcher, { revalidateOnFocus: false })

  useEffect(() => {
    const font = Number(localStorage.getItem("centro-liturgico-fonte"))
    if (font >= 14 && font <= 24) setFonte(font)
    setNoturno(localStorage.getItem("centro-liturgico-noturno") === "1")
  }, [])

  const grupo = useMemo(() => misteriosRosario.find((item) => item.grupo === misterio) ?? misteriosRosario[0], [misterio])

  function salvarFonte(valor: number) {
    const novo = Math.max(14, Math.min(24, valor))
    setFonte(novo)
    localStorage.setItem("centro-liturgico-fonte", String(novo))
  }

  function alternarNoturno() {
    const novo = !noturno
    setNoturno(novo)
    localStorage.setItem("centro-liturgico-noturno", novo ? "1" : "0")
  }

  const shell = noturno ? "bg-[#15130f] text-[#f4ead4]" : "bg-[#fffaf0] text-[#443b32]"
  const card = noturno ? "border-[#655735] bg-[#211e18]" : "border-[#ded2b9] bg-[#fffdf8]"

  return <section className={`min-h-[70vh] rounded-3xl border border-[#d4af37]/35 p-3 shadow-sm transition sm:p-5 ${shell}`} style={{ fontSize: fonte }}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d4af37]/40 bg-[#7b1326] px-4 py-4 text-white">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#f1d77e]">Comunidade Santa Luzia</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">Central de Liturgia Offline</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-white/80 sm:text-sm">A Central usa somente conteúdo armazenado na base do aplicativo. Não há fallback para sites externos.</p>
      </div>
      {aba !== "inicio" && <button type="button" onClick={() => setAba("inicio")} className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold">← Voltar ao menu</button>}
    </div>

    {aba === "inicio" && <>
      <div className={`mb-4 rounded-2xl border p-4 ${card}`}>
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${data ? "bg-[#dff3e6] text-[#0b4b35]" : "bg-[#fbe5e8] text-[#8f182e]"}`}><Database className="size-5" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#aa8126]">Estado da base de hoje</p>
            {data ? <><h2 className="mt-1 font-serif text-xl font-semibold">{data.liturgia}</h2><p className="mt-1 text-sm opacity-75">{data.data} · {data.cor} · conteúdo offline disponível · Quiz alinhado disponível</p></> : <><h2 className="mt-1 font-serif text-xl font-semibold text-[#8f182e]">Sem arquivo offline para a data</h2><p className="mt-1 text-sm opacity-75">A Liturgia não será substituída por conteúdo online e o Quiz Litúrgico ficará bloqueado.</p></>}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recursosCentro.map((recurso) => <button key={recurso.id} type="button" onClick={() => setAba(recurso.id as Aba)} className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d4af37] ${card}`}>
          <span className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-[#073b29] text-[#f2cf62]"><Icone id={recurso.id} /></span>
          <h2 className="font-serif text-xl font-semibold text-[#8f182e]">{recurso.titulo}</h2>
          <p className="mt-2 text-sm leading-6 opacity-75">{recurso.descricao}</p>
        </button>)}
      </div>
    </>}

    {aba === "liturgia" && <LiturgiaDiaria />}

    {aba === "horas" && <div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Acervo real do APK</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Liturgia das Horas</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 opacity-75">Estas são as Horas efetivamente identificadas no acervo offline, incluindo o Ofício das Leituras e seu ciclo bienal.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {horasCanonicas.map((hora) => <article key={hora.id} className={`rounded-2xl border p-4 ${card} ${hora.destaque ? "ring-1 ring-[#d4af37]/60" : ""}`}>
          <div className="flex items-center justify-between gap-3"><h3 className="font-serif text-xl font-semibold text-[#8f182e]">{hora.nome}</h3><span className="rounded-full bg-[#f6e7b7] px-2.5 py-1 text-[10px] font-bold text-[#6f4d0d]">{hora.horario}</span></div>
          <p className="mt-2 text-sm leading-6 opacity-75">{hora.resumo}</p>
        </article>)}
      </div>
      <div className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${card}`}><strong>Base encontrada:</strong> 3.749 documentos HTML de texto em <code>Resources/oficio</code>, distribuídos entre Advento, Natal, Quaresma, Páscoa, Tempo Comum, próprios, comuns e horas canônicas. A importação para o formato interno do Santa Luzia é feita sem imagens.</div>
    </div>}

    {aba === "acervo" && <div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Sem cartões genéricos</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Acervo Offline identificado</h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 opacity-75">Abaixo estão apenas categorias que realmente existem no APK enviado. “Mapeado” significa que os arquivos foram identificados e estão na fila de conversão para a nossa base; “importado” significa que a estrutura já está incorporada.</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {inventarioOffline.map((modulo) => <article key={modulo.id} className={`rounded-2xl border p-4 ${card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#073b29] text-[#f2cf62]"><Library className="size-5" /></span><div><h3 className="font-serif text-xl font-semibold text-[#8f182e]">{modulo.titulo}</h3><p className="mt-1 text-sm leading-6 opacity-75">{modulo.descricao}</p></div></div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${modulo.estado === "importado" ? "bg-[#dff3e6] text-[#0b4b35]" : "bg-[#f6e7b7] text-[#6f4d0d]"}`}>{modulo.estado}</span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider opacity-60">{typeof modulo.quantidade === "number" ? `${modulo.quantidade} documentos` : modulo.quantidade}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{modulo.secoes.map((item) => <span key={item} className="rounded-lg border border-[#d4af37]/25 px-2 py-1 text-[11px]">{item}</span>)}</div>
        </article>)}
      </div>
    </div>}

    {aba === "rosario" && <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Rosário</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Santo Rosário</h2></div><button type="button" onClick={() => { setMisterio(misterioDoDia()); setIndice(0); setAveMarias(0) }} className="inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/50 px-3 py-2 text-xs font-bold"><RotateCcw className="size-4" /> Mistérios de hoje</button></div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{misteriosRosario.map((item) => <button key={item.grupo} type="button" onClick={() => { setMisterio(item.grupo); setIndice(0); setAveMarias(0) }} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${misterio === item.grupo ? "bg-[#7b1326] text-white" : "bg-[#f6e7b7] text-[#6b4a10]"}`}>{item.grupo}</button>)}</div>
      <div className={`rounded-3xl border p-5 text-center ${card}`}>
        <p className="text-xs font-bold uppercase tracking-wider text-[#aa8126]">{indice + 1}º mistério · {grupo.grupo}</p>
        <h3 className="mt-3 font-serif text-2xl font-semibold text-[#8f182e]">{grupo.misterios[indice].titulo}</h3><p className="mt-2 text-sm opacity-75">{grupo.misterios[indice].referencia}</p>
        <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-4"><button type="button" onClick={() => { setIndice((v) => (v + 4) % 5); setAveMarias(0) }} className="flex size-11 items-center justify-center rounded-full border border-[#d4af37]/60"><ChevronLeft /></button><div className="min-w-28 rounded-2xl bg-[#7b1326] px-4 py-3 text-white"><div className="text-3xl font-bold">{aveMarias}/10</div><div className="text-[10px] uppercase tracking-wide text-white/75">Ave-Marias</div></div><button type="button" onClick={() => { setIndice((v) => (v + 1) % 5); setAveMarias(0) }} className="flex size-11 items-center justify-center rounded-full border border-[#d4af37]/60"><ChevronRight /></button></div>
        <button type="button" onClick={() => setAveMarias((v) => Math.min(10, v + 1))} className="mt-4 rounded-xl bg-[#073b29] px-5 py-3 text-sm font-bold text-white">Registrar Ave-Maria</button>{aveMarias > 0 && <button type="button" onClick={() => setAveMarias((v) => Math.max(0, v - 1))} className="ml-2 mt-4 rounded-xl border px-4 py-3 text-sm font-bold">Voltar uma</button>}
      </div>
    </div>}

    {aba === "calendario" && <CalendarioLiturgico />}

    {aba === "leitura" && <div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Preferências</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Modo de Leitura</h2>
      <div className={`mt-5 rounded-2xl border p-5 ${card}`}><div className="flex flex-wrap items-center justify-between gap-4"><div><strong>Tamanho da letra</strong><p className="mt-1 text-sm opacity-70">Ajuste entre 14 e 24 pixels.</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => salvarFonte(fonte - 1)} className="flex size-10 items-center justify-center rounded-xl border"><Minus /></button><span className="min-w-12 text-center font-bold">{fonte}</span><button type="button" onClick={() => salvarFonte(fonte + 1)} className="flex size-10 items-center justify-center rounded-xl border"><Plus /></button></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#d4af37]/25 pt-5"><div><strong>Modo noturno</strong><p className="mt-1 text-sm opacity-70">Reduz o brilho para leitura em ambientes escuros.</p></div><button type="button" onClick={alternarNoturno} className="inline-flex items-center gap-2 rounded-xl bg-[#7b1326] px-4 py-2.5 text-sm font-bold text-white">{noturno ? <Sun className="size-4" /> : <Moon className="size-4" />}{noturno ? "Modo claro" : "Modo noturno"}</button></div></div>
    </div>}
  </section>
}
