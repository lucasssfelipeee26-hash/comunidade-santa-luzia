"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Church,
  Clock3,
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
import { horasCanonicas, misteriosRosario, partesMissa, recursosCentro } from "@/lib/centro-liturgico"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
type Aba = "inicio" | "liturgia" | "horas" | "rosario" | "missa" | "calendario" | "leitura"

function misterioDoDia() {
  const dia = new Date().getDay()
  if (dia === 1 || dia === 6) return "Gozosos"
  if (dia === 2 || dia === 5) return "Dolorosos"
  if (dia === 4) return "Luminosos"
  return "Gloriosos"
}

export function CentroLiturgico() {
  const [aba, setAba] = useState<Aba>("inicio")
  const [misterio, setMisterio] = useState(misterioDoDia)
  const [indice, setIndice] = useState(0)
  const [aveMarias, setAveMarias] = useState(0)
  const [fonte, setFonte] = useState(17)
  const [noturno, setNoturno] = useState(false)
  const { data } = useSWR<Liturgia>("/api/liturgia", fetcher, { revalidateOnFocus: false })

  useEffect(() => {
    const font = Number(localStorage.getItem("centro-liturgico-fonte"))
    if (font >= 14 && font <= 24) setFonte(font)
    setNoturno(localStorage.getItem("centro-liturgico-noturno") === "1")
  }, [])

  const grupo = useMemo(
    () => misteriosRosario.find((item) => item.grupo === misterio) ?? misteriosRosario[0],
    [misterio],
  )

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

  return (
    <section className={`min-h-[70vh] rounded-3xl border border-[#d4af37]/35 p-3 shadow-sm transition sm:p-5 ${shell}`} style={{ fontSize: fonte }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d4af37]/40 bg-[#7b1326] px-4 py-4 text-white">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#f1d77e]">Comunidade Santa Luzia</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">Centro Litúrgico</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/80 sm:text-sm">Oração, Palavra, calendário e preparação litúrgica reunidos em um só lugar.</p>
        </div>
        {aba !== "inicio" && (
          <button type="button" onClick={() => setAba("inicio")} className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">
            ← Voltar ao menu
          </button>
        )}
      </div>

      {aba === "inicio" && (
        <>
          {data?.liturgia && (
            <div className={`mb-4 rounded-2xl border p-4 ${card}`}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f6e7b7] text-[#7b1326]"><Sparkles className="size-5" /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#aa8126]">Hoje na Igreja</p>
                  <h2 className="mt-1 font-serif text-xl font-semibold">{data.liturgia}</h2>
                  <p className="mt-1 text-sm opacity-75">{data.data} · Cor litúrgica: {data.cor}</p>
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recursosCentro.map((recurso) => (
              <button key={recurso.id} type="button" onClick={() => setAba(recurso.id as Aba)} className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d4af37] ${card}`}>
                <span className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-[#073b29] text-[#f2cf62]">
                  {recurso.id === "liturgia" ? <BookOpenText className="size-5" /> : recurso.id === "horas" ? <Clock3 className="size-5" /> : recurso.id === "missa" ? <Church className="size-5" /> : recurso.id === "calendario" ? <CalendarDays className="size-5" /> : recurso.id === "leitura" ? <Settings2 className="size-5" /> : <Sparkles className="size-5" />}
                </span>
                <h2 className="font-serif text-xl font-semibold text-[#8f182e]">{recurso.titulo}</h2>
                <p className="mt-2 text-sm leading-6 opacity-75">{recurso.descricao}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {aba === "liturgia" && <LiturgiaDiaria />}

      {aba === "horas" && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Oração da Igreja</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Liturgia das Horas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 opacity-75">Organização das horas canônicas para acompanhar a oração da Igreja ao longo do dia.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {horasCanonicas.map((hora) => (
              <article key={hora.id} className={`rounded-2xl border p-4 ${card} ${hora.destaque ? "ring-1 ring-[#d4af37]/60" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl font-semibold text-[#8f182e]">{hora.nome}</h3>
                  <span className="rounded-full bg-[#f6e7b7] px-2.5 py-1 text-[10px] font-bold text-[#6f4d0d]">{hora.horario}</span>
                </div>
                <p className="mt-2 text-sm leading-6 opacity-75">{hora.resumo}</p>
              </article>
            ))}
          </div>
          <div className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${card}`}>
            <strong>Estrutura de apoio:</strong> abertura, hino, salmodia, leitura, responsório, cântico quando previsto, preces, Pai-Nosso e oração conclusiva. Os textos próprios devem ser consultados em fonte litúrgica autorizada.
          </div>
        </div>
      )}

      {aba === "rosario" && (
        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Devoção mariana</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Santo Rosário</h2>
            </div>
            <button type="button" onClick={() => { setMisterio(misterioDoDia()); setIndice(0); setAveMarias(0) }} className="inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/50 px-3 py-2 text-xs font-bold"><RotateCcw className="size-4" /> Mistérios de hoje</button>
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {misteriosRosario.map((item) => (
              <button key={item.grupo} type="button" onClick={() => { setMisterio(item.grupo); setIndice(0); setAveMarias(0) }} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${misterio === item.grupo ? "bg-[#7b1326] text-white" : "bg-[#f6e7b7] text-[#6b4a10]"}`}>{item.grupo}</button>
            ))}
          </div>
          <div className={`rounded-3xl border p-5 text-center ${card}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#aa8126]">{indice + 1}º mistério · {grupo.grupo}</p>
            <h3 className="mt-3 font-serif text-2xl font-semibold text-[#8f182e]">{grupo.misterios[indice].titulo}</h3>
            <p className="mt-2 text-sm opacity-75">{grupo.misterios[indice].referencia}</p>
            <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-4">
              <button type="button" onClick={() => { setIndice((v) => (v + 4) % 5); setAveMarias(0) }} className="flex size-11 items-center justify-center rounded-full border border-[#d4af37]/60"><ChevronLeft /></button>
              <div className="min-w-28 rounded-2xl bg-[#7b1326] px-4 py-3 text-white"><div className="text-3xl font-bold">{aveMarias}/10</div><div className="text-[10px] uppercase tracking-wide text-white/75">Ave-Marias</div></div>
              <button type="button" onClick={() => { setIndice((v) => (v + 1) % 5); setAveMarias(0) }} className="flex size-11 items-center justify-center rounded-full border border-[#d4af37]/60"><ChevronRight /></button>
            </div>
            <button type="button" onClick={() => setAveMarias((v) => Math.min(10, v + 1))} className="mt-4 rounded-xl bg-[#073b29] px-5 py-3 text-sm font-bold text-white">Registrar Ave-Maria</button>
            {aveMarias > 0 && <button type="button" onClick={() => setAveMarias((v) => Math.max(0, v - 1))} className="ml-2 mt-4 rounded-xl border px-4 py-3 text-sm font-bold">Voltar uma</button>}
          </div>
        </div>
      )}

      {aba === "missa" && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Preparação para servir</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Guia da Santa Missa</h2>
          <div className="mt-5 space-y-3">
            {partesMissa.map((parte) => (
              <article key={parte.etapa} className={`rounded-2xl border p-4 ${card}`}>
                <h3 className="font-serif text-xl font-semibold text-[#8f182e]">{parte.etapa}</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">{parte.itens.map((item) => <li key={item} className="rounded-xl bg-black/[.035] px-3 py-2 text-sm">• {item}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      )}

      {aba === "calendario" && <CalendarioLiturgico />}

      {aba === "leitura" && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#aa8126]">Preferências</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Modo de Leitura</h2>
          <div className={`mt-5 rounded-2xl border p-5 ${card}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><strong>Tamanho da letra</strong><p className="mt-1 text-sm opacity-70">Ajuste entre 14 e 24 pixels.</p></div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => salvarFonte(fonte - 1)} className="flex size-10 items-center justify-center rounded-xl border"><Minus /></button><span className="min-w-12 text-center font-bold">{fonte}</span><button type="button" onClick={() => salvarFonte(fonte + 1)} className="flex size-10 items-center justify-center rounded-xl border"><Plus /></button></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#d4af37]/25 pt-5">
              <div><strong>Modo noturno</strong><p className="mt-1 text-sm opacity-70">Reduz o brilho para leitura em ambientes escuros.</p></div>
              <button type="button" onClick={alternarNoturno} className="inline-flex items-center gap-2 rounded-xl bg-[#7b1326] px-4 py-2.5 text-sm font-bold text-white">{noturno ? <Sun className="size-4" /> : <Moon className="size-4" />}{noturno ? "Modo claro" : "Modo noturno"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
