"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Bell, BrainCircuit, CalendarDays, CheckCheck, Gamepad2, Sparkles, Trophy, X } from "lucide-react"

type Notificacao = {
  id: string
  tipo: "quiz" | "missao" | "ranking" | "avulso" | "escala" | "sistema"
  titulo: string
  mensagem: string
  href: string
  criado_em: number
  lida_em: number | null
}

type Dados = { autenticado?: boolean; notificacoes?: Notificacao[]; naoLidas?: number }
const fetcher = (url: string) => fetch(url, { cache: "no-store", credentials: "same-origin" }).then(async (r) => r.ok ? r.json() : null)

function Icone({ tipo }: { tipo: Notificacao["tipo"] }) {
  if (tipo === "quiz") return <BrainCircuit className="size-4" />
  if (tipo === "missao") return <Gamepad2 className="size-4" />
  if (tipo === "ranking") return <Trophy className="size-4" />
  if (tipo === "escala") return <CalendarDays className="size-4" />
  if (tipo === "avulso") return <Sparkles className="size-4" />
  return <Bell className="size-4" />
}

function tempo(ts: number) {
  const minutos = Math.max(0, Math.floor((Date.now() - ts) / 60_000))
  if (minutos < 1) return "agora"
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas} h`
  return new Date(ts).toLocaleDateString("pt-BR")
}

export function NotificationCenter() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const { data, mutate } = useSWR<Dados>("/api/notificacoes", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })
  const notificacoes = data?.notificacoes || []
  const naoLidas = Number(data?.naoLidas || 0)

  useEffect(() => {
    const atualizar = () => void mutate()
    window.addEventListener("santa-luzia:server-sync", atualizar)
    return () => window.removeEventListener("santa-luzia:server-sync", atualizar)
  }, [mutate])

  async function marcar(id: string) {
    await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined)
    await mutate()
  }

  async function abrirNotificacao(n: Notificacao) {
    if (!n.lida_em) await marcar(n.id)
    setAberto(false)
    router.push(n.href)
    router.refresh()
  }

  async function marcarTodas() {
    await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "todas" }),
    }).catch(() => undefined)
    await mutate()
  }

  return (
    <div className="relative shrink-0" data-no-pull-refresh>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={naoLidas ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
        className="relative inline-flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-white text-primary shadow-sm transition active:scale-95 sm:size-10"
      >
        <Bell className="size-[17px]" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <button type="button" aria-label="Fechar notificações" className="fixed inset-0 z-[85] bg-black/25 backdrop-blur-sm" onClick={() => setAberto(false)} />
          <section role="dialog" aria-modal="true" aria-label="Notificações" className="fixed left-1/2 top-1/2 z-[90] flex max-h-[78vh] w-[calc(100%_-_24px)] max-w-[470px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-2xl backdrop-blur-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-primary">Notificações</h2>
                <p className="text-xs text-muted-foreground">{naoLidas ? `${naoLidas} não lida(s)` : "Tudo em dia"}</p>
              </div>
              <div className="flex gap-1">
                {naoLidas > 0 && <button type="button" onClick={() => void marcarTodas()} title="Marcar todas como lidas" className="inline-flex size-9 items-center justify-center rounded-xl text-primary hover:bg-primary/5"><CheckCheck className="size-4" /></button>}
                <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="inline-flex size-9 items-center justify-center rounded-xl text-primary hover:bg-primary/5"><X className="size-4" /></button>
              </div>
            </header>

            <div className="overflow-y-auto p-2">
              {notificacoes.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</div>}
              {notificacoes.map((n) => (
                <button key={n.id} type="button" onClick={() => void abrirNotificacao(n)} className={`mb-1 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition active:scale-[.99] ${n.lida_em ? "bg-white" : "bg-primary/[.055]"}`}>
                  <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${n.lida_em ? "bg-secondary text-primary" : "bg-primary text-white"}`}><Icone tipo={n.tipo} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <strong className="text-sm text-foreground">{n.titulo}</strong>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{tempo(n.criado_em)}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{n.mensagem}</span>
                  </span>
                  {!n.lida_em && <span className="mt-3 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
