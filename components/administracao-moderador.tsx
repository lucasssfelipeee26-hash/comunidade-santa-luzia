"use client"

import { useEffect, useMemo, useState } from "react"
import { Database, RefreshCw, Search, Trash2, Trophy, WifiOff } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Cadastro = {
  id: string
  nome: string
  usuario: string
  email: string
  funcao: string | null
  status: "pendente" | "aprovado" | "recusado"
  foto?: string | null
  criadoEm: number
}

type RespostaAdmin = {
  ok: boolean
  ano: number
  cadastros: Cadastro[]
  ranking: Array<{ usuarioId: string; nome: string; pontos: number; posicao: number }>
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

async function fisicamenteOnline() {
  try {
    const network = (window as typeof window & { Capacitor?: { Plugins?: { Network?: { getStatus?: () => Promise<{ connected?: boolean }> } } } }).Capacitor?.Plugins?.Network
    if (network?.getStatus) return Boolean((await network.getStatus()).connected)
  } catch {}
  return navigator.onLine !== false && document.documentElement.dataset.physicalNetwork !== "offline"
}

export function AdministracaoModerador() {
  const [dados, setDados] = useState<RespostaAdmin | null>(null)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState("")
  const [alvo, setAlvo] = useState<Cadastro | null>(null)
  const [confirmacaoExcluir, setConfirmacaoExcluir] = useState("")
  const [confirmacaoRanking, setConfirmacaoRanking] = useState("")
  const [processando, setProcessando] = useState<"excluir" | "ranking" | null>(null)

  async function carregar() {
    if (!(await fisicamenteOnline())) {
      setErro("A administração do banco exige internet para evitar operações destrutivas pendentes.")
      return
    }
    setCarregando(true)
    setErro("")
    try {
      const response = await fetch("/api/app/admin-dados", { cache: "no-store", credentials: "same-origin" })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.erro || "Não foi possível carregar a administração.")
      setDados(json)
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar administração.")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return dados?.cadastros ?? []
    return (dados?.cadastros ?? []).filter((cadastro) => `${cadastro.nome} ${cadastro.usuario} ${cadastro.email}`.toLocaleLowerCase("pt-BR").includes(termo))
  }, [dados, busca])

  async function executar(payload: Record<string, unknown>, tipo: "excluir" | "ranking") {
    if (!(await fisicamenteOnline())) {
      setErro("Esta ação só pode ser feita com internet.")
      return null
    }
    setProcessando(tipo)
    setErro("")
    try {
      const response = await fetch("/api/app/admin-dados", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(json?.erro || "A operação não pôde ser concluída.")
      return json
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha na operação administrativa.")
      return null
    } finally {
      setProcessando(null)
    }
  }

  async function excluirCadastro() {
    if (!alvo || confirmacaoExcluir.trim().toUpperCase() !== "EXCLUIR") return
    const json = await executar({ action: "excluir_cadastro", usuarioId: alvo.id, confirmacao: confirmacaoExcluir }, "excluir")
    if (!json) return
    setDados((atual) => atual ? { ...atual, cadastros: Array.isArray(json.cadastros) ? json.cadastros : atual.cadastros.filter((item) => item.id !== alvo.id) } : atual)
    setAlvo(null)
    setConfirmacaoExcluir("")
    window.dispatchEvent(new Event("santa-luzia:server-sync"))
  }

  async function zerarRanking() {
    if (!dados || confirmacaoRanking.trim().toUpperCase() !== "ZERAR") return
    const json = await executar({ action: "resetar_ranking", ano: dados.ano, confirmacao: confirmacaoRanking }, "ranking")
    if (!json) return
    setDados((atual) => atual ? { ...atual, ranking: Array.isArray(json.ranking) ? json.ranking : atual.ranking } : atual)
    setConfirmacaoRanking("")
    window.dispatchEvent(new Event("santa-luzia:server-sync"))
  }

  return (
    <details className="group mb-3 overflow-hidden rounded-2xl border border-primary/15 bg-white/85 shadow-sm" data-admin-database-tools="true">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 marker:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><Database className="size-4" /></span>
        <span className="min-w-0 flex-1"><strong className="block truncate font-serif text-[15px] text-primary">Administração de dados</strong><span className="block truncate text-[9px] text-muted-foreground">Excluir cadastros e controlar o placar.</span></span>
        <span className="rounded-full bg-primary/8 px-2 py-1 text-[9px] font-bold text-primary">Moderador</span>
      </summary>

      <div className="border-t border-primary/10 p-3">
        {erro && <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-950"><WifiOff className="mt-0.5 size-3.5 shrink-0" />{erro}</div>}

        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] leading-4 text-muted-foreground">Ações destrutivas não são salvas em fila offline. É obrigatório estar conectado.</p>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1 text-[9px]" onClick={() => void carregar()} disabled={carregando}><RefreshCw className={`size-3 ${carregando ? "animate-spin" : ""}`} />Atualizar</Button>
        </div>

        <section className="rounded-2xl border border-destructive/15 bg-destructive/[.025] p-3">
          <div className="flex items-start gap-2"><Trash2 className="mt-0.5 size-4 shrink-0 text-destructive" /><div><h3 className="text-xs font-bold text-destructive">Excluir cadastro do banco</h3><p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">Remove a conta e os dados ligados a ela. Esta ação não pode ser desfeita.</p></div></div>
          <div className="relative mt-3"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar nome, usuário ou e-mail" className="h-9 pl-8 text-[10px]" /></div>
          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto overscroll-contain pr-1" data-no-pull-refresh>
            {filtrados.map((cadastro) => (
              <button key={cadastro.id} type="button" onClick={() => { setAlvo(cadastro); setConfirmacaoExcluir("") }} className={`flex w-full min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition ${alvo?.id === cadastro.id ? "border-destructive/45 bg-destructive/5" : "border-border bg-white"}`}>
                <Avatar className="size-8 shrink-0"><AvatarImage src={cadastro.foto || undefined} /><AvatarFallback className="text-[9px]">{iniciais(cadastro.nome)}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{cadastro.nome}</strong><span className="block truncate text-[8px] text-muted-foreground">@{cadastro.usuario} · {cadastro.status}</span></span>
              </button>
            ))}
          </div>
          {alvo && <div className="mt-3 rounded-xl border border-destructive/20 bg-white p-3"><p className="text-[10px] leading-4">Você selecionou <strong>{alvo.nome}</strong>. Digite <strong>EXCLUIR</strong> para confirmar.</p><div className="mt-2 flex gap-2"><Input value={confirmacaoExcluir} onChange={(event) => setConfirmacaoExcluir(event.target.value)} placeholder="EXCLUIR" className="h-9 text-[10px]" autoComplete="off" /><Button type="button" variant="destructive" className="h-9 shrink-0 text-[10px]" onClick={() => void excluirCadastro()} disabled={processando !== null || confirmacaoExcluir.trim().toUpperCase() !== "EXCLUIR"}>{processando === "excluir" ? "Excluindo…" : "Excluir"}</Button></div></div>}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d4af37]/35 bg-[#fff9e9] p-3">
          <div className="flex items-start gap-2"><Trophy className="mt-0.5 size-4 shrink-0 text-[#8a6516]" /><div><h3 className="text-xs font-bold text-[#6f5114]">Resetar placar do ranking · {dados?.ano ?? "—"}</h3><p className="mt-0.5 text-[9px] leading-4 text-[#75684c]">Zera os pontos atuais preservando quizzes, histórico e demais registros. Novos pontos começam a contar a partir do reset.</p></div></div>
          <p className="mt-2 text-[9px] text-muted-foreground">{dados?.ranking?.length ?? 0} participantes no placar atual. Digite <strong>ZERAR</strong> para confirmar.</p>
          <div className="mt-2 flex gap-2"><Input value={confirmacaoRanking} onChange={(event) => setConfirmacaoRanking(event.target.value)} placeholder="ZERAR" className="h-9 bg-white text-[10px]" autoComplete="off" /><Button type="button" className="h-9 shrink-0 bg-[#7b1326] text-[10px]" onClick={() => void zerarRanking()} disabled={processando !== null || !dados || confirmacaoRanking.trim().toUpperCase() !== "ZERAR"}>{processando === "ranking" ? "Zerando…" : "Resetar"}</Button></div>
        </section>
      </div>
    </details>
  )
}
