"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Bell, BrainCircuit, CalendarDays, Gamepad2, Sparkles, Trophy, X } from "lucide-react"
import { carregarNotificacoesCache, enfileirarTodasNotificacoesLidas, marcarCacheComoLido, salvarNotificacoesCache, ultimoUsuarioNotificacoes } from "@/lib/local-notification-cache"

type Notificacao = {
  id: string
  tipo: "quiz" | "missao" | "ranking" | "avulso" | "escala" | "sistema"
  titulo: string
  mensagem: string
  href: string
  criado_em: number
  lida_em: number | null
}

type Dados = { autenticado?: boolean; usuario?: { id?: string }; notificacoes?: Notificacao[]; naoLidas?: number; offline?: boolean }

const fetcher = async (url: string): Promise<Dados | null> => {
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" })
    if (response.ok) {
      const dados = await response.json() as Dados
      const usuarioId = String(dados.usuario?.id || "")
      if (dados.autenticado && usuarioId && Array.isArray(dados.notificacoes)) {
        await salvarNotificacoesCache(usuarioId, dados.notificacoes, dados.naoLidas)
      }
      return dados
    }
  } catch {}

  const cache = carregarNotificacoesCache()
  if (!cache) return null
  return {
    autenticado: true,
    usuario: { id: cache.usuarioId },
    notificacoes: cache.notificacoes as Notificacao[],
    naoLidas: cache.naoLidas,
    offline: true,
  }
}

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
    dedupingInterval: 2_000,
  })
  const notificacoes = data?.notificacoes || []
  const naoLidas = Number(data?.naoLidas || 0)

  useEffect(() => {
    const atualizar = () => void mutate()
    window.addEventListener("santa-luzia:server-sync", atualizar)
    window.addEventListener("santa-luzia:notificacoes-atualizadas", atualizar)
    return () => {
      window.removeEventListener("santa-luzia:server-sync", atualizar)
      window.removeEventListener("santa-luzia:notificacoes-atualizadas", atualizar)
    }
  }, [mutate])

  function marcarTodasComoVistas() {
    if (!data || naoLidas <= 0) return
    const agora = Date.now()
    const usuarioId = String(data.usuario?.id || ultimoUsuarioNotificacoes() || "")
    const atualizadas = notificacoes.map((n) => ({ ...n, lida_em: n.lida_em || agora }))
    void mutate({ ...data, naoLidas: 0, notificacoes: atualizadas }, false)
    if (usuarioId) marcarCacheComoLido(usuarioId)

    if (!navigator.onLine) {
      if (usuarioId) enfileirarTodasNotificacoesLidas(usuarioId)
      return
    }

    void fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "todas" }),
    })
      .then((response) => {
        if (!response.ok && usuarioId) enfileirarTodasNotificacoesLidas(usuarioId)
        if (response.ok) void mutate()
      })
      .catch(() => { if (usuarioId) enfileirarTodasNotificacoesLidas(usuarioId) })
  }

  function abrirCentro() {
    setAberto(true)
    marcarTodasComoVistas()
  }

  function abrirNotificacao(n: Notificacao) {
    setAberto(false)
    router.push(n.href)
    router.refresh()
  }

  return (
    <div className="relative shrink-0" data-no-pull-refresh>
      <button
        type="button"
        onClick={abrirCentro}
        aria-label={naoLidas ? `Notificações, ${naoLidas} novas` : "Notificações"}
        className="relative inline-flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-white text-primary shadow-sm transition active:scale-95 sm:size-10"
      >
        <Bell className="size-[17px]" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <button type="button" aria-label="Fechar notificações" className="fixed inset-0 z-[115] bg-black/30 backdrop-blur-sm" onClick={() => setAberto(false)} />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Notificações"
            className="fixed inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] top-[calc(env(safe-area-inset-top)+72px)] z-[120] mx-auto flex max-w-[470px] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-2xl"
          >
            <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="font-serif text-xl font-semibold text-primary">Notificações</h2>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="inline-flex size-9 items-center justify-center rounded-xl text-primary hover:bg-primary/5">
                <X className="size-4" />
              </button>
            </header>

            {data?.offline && <div className="mx-3 mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">Exibindo as notificações salvas neste aparelho. A sincronização será retomada quando a conexão voltar.</div>}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-4">
              {notificacoes.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</div>}
              {notificacoes.map((n) => (
                <button key={n.id} type="button" onClick={() => abrirNotificacao(n)} className="mb-1 flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left transition active:scale-[.99] hover:bg-primary/[.035]">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icone tipo={n.tipo} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <strong className="min-w-0 break-words text-sm text-foreground">{n.titulo}</strong>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{tempo(n.criado_em)}</span>
                    </span>
                    <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">{n.mensagem}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
