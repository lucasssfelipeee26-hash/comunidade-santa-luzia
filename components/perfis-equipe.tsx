"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Medal, Search, ShieldCheck, Trophy, UserRound, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AreaHeader } from "@/components/area-header"
import { MembroMenu, ModeradorMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Perfil = {
  id: string
  nome: string
  funcao: "Acólito" | "Coroinha"
  desde?: string | null
  foto?: string | null
  bio?: string
  ranking?: { posicao: number; pontos: number; quizzesRespondidos: number; acertos: number; aproveitamento: number } | null
}

type Props = { tipoUsuario: "membro" | "moderador" }

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

function dataBonita(valor?: string | null) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "data não informada"
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${valor}T12:00:00`))
}

export function PerfisEquipe({ tipoUsuario }: Props) {
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [offline, setOffline] = useState(false)

  async function carregar() {
    try {
      const r = await fetch("/api/perfis", { cache: "no-store" })
      if (!r.ok) throw new Error()
      const j = await r.json()
      setPerfis(Array.isArray(j.perfis) ? j.perfis : [])
      try { localStorage.setItem("santa-luzia:perfis-publicos:v1", JSON.stringify({ atualizadoEm: Date.now(), perfis: j.perfis || [] })) } catch {}
      setOffline(false)
    } catch {
      try {
        const salvo = JSON.parse(localStorage.getItem("santa-luzia:perfis-publicos:v1") || "null")
        if (Array.isArray(salvo?.perfis)) {
          setPerfis(salvo.perfis)
          setOffline(true)
        }
      } catch {}
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return perfis
    return perfis.filter((perfil) => `${perfil.nome} ${perfil.funcao}`.toLocaleLowerCase("pt-BR").includes(termo))
  }, [perfis, busca])

  const menu = tipoUsuario === "moderador" ? <ModeradorMenu /> : <MembroMenu />
  const voltar = tipoUsuario === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7df_0%,#fff_42%,#faf7f1_100%)]">
      <AreaHeader titulo="Perfis da Equipe" subtitulo="Conheça os acólitos e coroinhas e acompanhe a Jornada" voltarHref={voltar} menu={menu} />
      <main className="mx-auto max-w-6xl px-3 py-5 pb-24 sm:px-4 sm:py-8">
        <section className="mb-5 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_45px_rgba(79,24,35,.08)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Comunidade Santa Luzia</p>
              <h1 className="mt-1 font-serif text-2xl font-semibold text-primary">Nossa equipe</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Aqui aparecem apenas informações públicas do serviço no altar. Faltas, advertências, justificativas e observações nunca são exibidas nesta área.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar membro" className="h-12 rounded-2xl bg-white/90 pl-9" />
            </div>
          </div>
          {offline && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Modo offline: mostrando os últimos perfis sincronizados neste aparelho.</p>}
        </section>

        {carregando ? <div className="rounded-3xl bg-white/70 p-8 text-center text-muted-foreground">Carregando perfis…</div> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((perfil) => (
              <button key={perfil.id} type="button" onClick={() => setSelecionado(perfil)} className="group rounded-[26px] border border-white/75 bg-white/80 p-4 text-left shadow-[0_12px_34px_rgba(79,24,35,.07)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_18px_42px_rgba(79,24,35,.11)] active:scale-[.99]">
                <div className="flex items-center gap-3">
                  <Avatar className="size-14 border-2 border-accent/45 shadow-sm"><AvatarImage src={perfil.foto || undefined} /><AvatarFallback className="bg-primary/10 font-bold text-primary">{iniciais(perfil.nome)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1"><h2 className="truncate font-serif text-lg font-semibold text-foreground">{perfil.nome}</h2><p className="text-xs font-semibold text-primary">{perfil.funcao}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Na equipe desde {dataBonita(perfil.desde)}</p></div>
                  {perfil.ranking && <span className="rounded-xl bg-primary/8 px-2.5 py-1.5 text-xs font-bold text-primary">{perfil.ranking.posicao}º</span>}
                </div>
                <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{perfil.bio || "Este membro ainda não adicionou uma bio."}</p>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs"><span className="text-muted-foreground">Ver perfil</span><span className="font-bold text-primary">{perfil.ranking?.pontos ?? 0} pts</span></div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selecionado && (
        <div className="fixed inset-0 z-[120] grid place-items-end bg-black/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onClick={() => setSelecionado(null)}>
          <section role="dialog" aria-modal="true" aria-label={`Perfil de ${selecionado.nome}`} onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] border border-white/70 bg-[#fffdf8] p-5 shadow-2xl sm:rounded-[32px] sm:p-6">
            <div className="flex justify-end"><button type="button" onClick={() => setSelecionado(null)} className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><X className="size-5" /></button></div>
            <div className="flex flex-col items-center text-center">
              <Avatar className="size-24 border-4 border-accent/45 shadow-lg"><AvatarImage src={selecionado.foto || undefined} /><AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{iniciais(selecionado.nome)}</AvatarFallback></Avatar>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[.18em] text-primary">Perfil público</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-primary">{selecionado.nome}</h2>
              <p className="mt-1 text-sm font-semibold text-foreground">{selecionado.funcao} · desde {dataBonita(selecionado.desde)}</p>
              <p className="mt-4 w-full rounded-2xl bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">{selecionado.bio || "Este membro ainda não adicionou uma bio."}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border bg-white p-3 text-center"><Trophy className="mx-auto size-5 text-primary" /><strong className="mt-1 block text-lg text-primary">{selecionado.ranking?.posicao ? `${selecionado.ranking.posicao}º` : "—"}</strong><span className="text-[10px] text-muted-foreground">Classificação</span></div>
              <div className="rounded-2xl border border-border bg-white p-3 text-center"><Medal className="mx-auto size-5 text-primary" /><strong className="mt-1 block text-lg text-primary">{selecionado.ranking?.pontos ?? 0}</strong><span className="text-[10px] text-muted-foreground">Pontos</span></div>
              <div className="rounded-2xl border border-border bg-white p-3 text-center"><ShieldCheck className="mx-auto size-5 text-primary" /><strong className="mt-1 block text-lg text-primary">{selecionado.ranking?.aproveitamento ?? 0}%</strong><span className="text-[10px] text-muted-foreground">Aproveitamento</span></div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/10 bg-primary/[.035] p-3 text-xs leading-5 text-muted-foreground"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" />Registros administrativos são privados e só podem ser consultados pelos moderadores.</div>
            <Button type="button" variant="outline" className="mt-5 w-full gap-2" onClick={() => setSelecionado(null)}><ArrowLeft className="size-4" />Voltar aos perfis</Button>
          </section>
        </div>
      )}
    </div>
  )
}
