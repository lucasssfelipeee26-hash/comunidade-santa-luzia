"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { ClockAlert, X } from "lucide-react"
import { useAuthSession } from "@/components/auth-session-runtime"

const emojis = ["⏰", "😅", "🙏", "✝️", "💛"]
const authPaths = ["/area-restrita/login", "/area-restrita/cadastro", "/area-restrita/recuperar-senha"]
const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store", credentials: "same-origin" })
  if (r.status === 401 || r.status === 403) return null
  const j = await r.json()
  if (!r.ok) throw new Error(j.erro || "Erro")
  return j
}

export function LateArrivalBanner() {
  const pathname = usePathname()
  const { liveAuthenticated } = useAuthSession()
  const enabled = liveAuthenticated && !authPaths.some((path) => pathname.startsWith(path))
  const { data, mutate } = useSWR(enabled ? "/api/ranking" : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
    refreshInterval: enabled ? 60_000 : 0,
    keepPreviousData: true,
  })
  const [oculto, setOculto] = useState(false)
  const [windowsBeta, setWindowsBeta] = useState<boolean | null>(null)
  const ocorrencia = useMemo(() => {
    const lista = (data?.ocorrencias || []).filter((o: any) => o.status === "confirmado").sort((a: any, b: any) => Number(b.criado_em) - Number(a.criado_em))
    return lista[0] || null
  }, [data])

  useEffect(() => {
    setWindowsBeta(navigator.userAgent.includes("SantaLuziaWindowsBeta/"))
  }, [])

  useEffect(() => {
    if (!enabled) return
    const refresh = () => void mutate()
    window.addEventListener("sl:ranking-refresh", refresh)
    return () => window.removeEventListener("sl:ranking-refresh", refresh)
  }, [enabled, mutate])

  useEffect(() => {
    if (!ocorrencia) return
    setOculto(localStorage.getItem(`santa-luzia:atraso-banner:${ocorrencia.id}`) === "1")
  }, [ocorrencia])

  if (windowsBeta !== false || !ocorrencia || oculto) return null
  const reacoes = data?.reacoes || []
  async function reagir(emoji: string) {
    await fetch("/api/ranking", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "reagir", ocorrenciaId: ocorrencia.id, emoji }) })
    await mutate()
  }
  function fechar() { localStorage.setItem(`santa-luzia:atraso-banner:${ocorrencia.id}`, "1"); setOculto(true) }

  return <aside className="sticky top-2 z-[65] mx-auto mt-2 w-[calc(100%-16px)] max-w-3xl rounded-2xl border border-amber-300/60 bg-white/80 p-3 shadow-[0_14px_45px_rgba(72,50,20,.14)] backdrop-blur-2xl"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><ClockAlert className="size-5"/></span><div className="min-w-0 flex-1"><p className="font-semibold text-foreground">Registro de pontualidade confirmado</p><p className="mt-0.5 text-sm text-muted-foreground">{ocorrencia.usuario_nome} teve um atraso confirmado na celebração de {String(ocorrencia.data_missa).split("-").reverse().join("/")}.</p><div className="mt-2 flex flex-wrap gap-1.5">{emojis.map((emoji)=>{const total=reacoes.filter((r:any)=>r.ocorrencia_id===ocorrencia.id&&r.emoji===emoji).length;return <button key={emoji} onClick={()=>reagir(emoji)} className="rounded-full border border-border bg-white/90 px-2.5 py-1 text-sm shadow-sm transition hover:-translate-y-0.5">{emoji}{total?` ${total}`:""}</button>})}</div></div><button onClick={fechar} aria-label="Fechar aviso" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-muted-foreground"><X className="size-4"/></button></div></aside>
}
