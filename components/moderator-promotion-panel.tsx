"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, Search, ShieldAlert, UserCog, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore, type Membro } from "@/lib/store"

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

const rotuloStatus = { aprovado: "Aprovado", pendente: "Pendente", recusado: "Recusado" } as const

export function ModeratorPromotionPanel() {
  const { membros, promoverMembro } = useStore()
  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState<Membro | null>(null)
  const [promovendo, setPromovendo] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  const resultados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    if (!termo) return membros
    return membros.filter((membro) => [membro.nome, membro.usuario, membro.email, membro.funcao].some((valor) => String(valor || "").toLocaleLowerCase("pt-BR").includes(termo)))
  }, [busca, membros])

  async function confirmarPromocao() {
    if (!selecionado || promovendo) return
    setPromovendo(true); setErro(""); setMensagem("")
    const nome = selecionado.nome
    try {
      const resultado = await promoverMembro(selecionado.id)
      if (!resultado.ok) throw new Error(resultado.erro || "Não foi possível promover este cadastro.")
      setSelecionado(null); setBusca("")
      setMensagem(resultado.mensagem || `${nome} agora é moderador.`)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível promover este cadastro.")
    } finally { setPromovendo(false) }
  }

  return (
    <details className="group mb-3 overflow-hidden rounded-2xl border border-border bg-white/80 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 marker:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><UserCog className="size-4" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-serif text-base font-semibold text-primary">Gerenciar moderadores</h2><p className="truncate text-[10px] text-muted-foreground">Promover cadastros existentes com segurança.</p></div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>

      <div className="space-y-2.5 border-t border-border/70 p-3">
        <div className="flex items-start gap-2 rounded-xl bg-secondary/60 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" /><p>O novo moderador terá acesso completo ao painel. Confirme apenas pessoas autorizadas.</p></div>
        {mensagem && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[10px] leading-4 text-emerald-800" role="status"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /><span>{mensagem}</span></div>}

        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar nome, usuário ou e-mail" aria-label="Buscar cadastro para promover" className="h-9 rounded-xl pl-9 text-xs" /></div>

        <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
          {resultados.length === 0 ? <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nenhum cadastro encontrado.</p> : resultados.map((membro) => (
            <div key={membro.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card p-2">
              <Avatar className="size-9 shrink-0 border border-border"><AvatarImage src={membro.foto || undefined} /><AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{iniciais(membro.nome)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-xs font-semibold text-foreground">{membro.nome}</p><Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[8px]">{rotuloStatus[membro.status]}</Badge></div><p className="truncate text-[9px] text-muted-foreground">@{membro.usuario} · {membro.funcao}</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => { setSelecionado(membro); setErro(""); setMensagem("") }} className="h-8 shrink-0 gap-1 rounded-lg px-2 text-[10px]"><UserCog className="size-3" /> Promover</Button>
            </div>
          ))}
        </div>

        {selecionado && (
          <div className="rounded-xl border border-primary/20 bg-primary/[.025] p-3" role="alertdialog" aria-labelledby="confirmar-promocao-titulo">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 id="confirmar-promocao-titulo" className="font-serif text-base font-semibold text-primary">Confirmar promoção</h3><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Transformar <strong className="text-foreground">{selecionado.nome}</strong> em moderador mantendo a conta atual?</p></div><button type="button" aria-label="Cancelar promoção" onClick={() => { setSelecionado(null); setErro("") }} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-muted-foreground"><X className="size-3.5" /></button></div>
            {erro && <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">{erro}</p>}
            <div className="mt-2 flex justify-end gap-1.5"><Button type="button" size="sm" variant="outline" onClick={() => { setSelecionado(null); setErro("") }} disabled={promovendo} className="h-8 text-[10px]">Cancelar</Button><Button type="button" size="sm" onClick={confirmarPromocao} disabled={promovendo} className="h-8 gap-1 text-[10px]"><ShieldAlert className="size-3" />{promovendo ? "Promovendo…" : "Confirmar"}</Button></div>
          </div>
        )}
      </div>
    </details>
  )
}
