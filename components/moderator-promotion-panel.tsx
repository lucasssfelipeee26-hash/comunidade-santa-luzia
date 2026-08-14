"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Search, ShieldAlert, UserCog, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore, type Membro } from "@/lib/store"

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

const rotuloStatus = {
  aprovado: "Aprovado",
  pendente: "Pendente",
  recusado: "Recusado",
} as const

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
    return membros.filter((membro) =>
      [membro.nome, membro.usuario, membro.email, membro.funcao]
        .some((valor) => String(valor || "").toLocaleLowerCase("pt-BR").includes(termo)),
    )
  }, [busca, membros])

  async function confirmarPromocao() {
    if (!selecionado || promovendo) return
    setPromovendo(true)
    setErro("")
    setMensagem("")
    const nome = selecionado.nome

    try {
      const resultado = await promoverMembro(selecionado.id)
      if (!resultado.ok) throw new Error(resultado.erro || "Não foi possível promover este cadastro.")
      setSelecionado(null)
      setBusca("")
      setMensagem(resultado.mensagem || `${nome} agora é moderador.`)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível promover este cadastro.")
    } finally {
      setPromovendo(false)
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-[#ddc9ba] bg-white/85 shadow-[0_18px_45px_rgba(79,24,35,.07)] sm:mb-8">
      <div className="border-b border-[#eadfd8] bg-[linear-gradient(135deg,#fffaf0,#f8eee4)] p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <UserCog className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-primary">Gerenciar moderadores</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Promova um cadastro existente sem criar outra conta ou senha.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-3.5 text-sm leading-6 text-amber-950">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            O novo moderador terá acesso completo ao painel e também poderá promover outros cadastros. A promoção deve ser confirmada pelo moderador que já está conectado.
          </p>
        </div>

        {mensagem && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800" role="status">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>{mensagem} A pessoa deve sair e entrar novamente para abrir o painel de moderador.</span>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome, usuário ou e-mail"
            aria-label="Buscar cadastro para promover"
            className="h-12 pl-10"
          />
        </div>

        <div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">
          {resultados.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum cadastro encontrado.
            </p>
          ) : resultados.map((membro) => (
            <div key={membro.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <Avatar className="size-11 border border-border">
                <AvatarImage src={membro.foto || undefined} />
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{iniciais(membro.nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-foreground">{membro.nome}</p>
                  <Badge variant="outline" className="text-[10px]">{rotuloStatus[membro.status]}</Badge>
                </div>
                <p className="truncate text-xs leading-5 text-muted-foreground">@{membro.usuario} · {membro.email}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => { setSelecionado(membro); setErro(""); setMensagem("") }} className="gap-1.5">
                <UserCog className="size-4" aria-hidden="true" /> Promover
              </Button>
            </div>
          ))}
        </div>

        {selecionado && (
          <div className="rounded-2xl border-2 border-primary/25 bg-primary/[.035] p-4" role="alertdialog" aria-labelledby="confirmar-promocao-titulo" aria-describedby="confirmar-promocao-texto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="confirmar-promocao-titulo" className="font-serif text-xl font-semibold text-primary">Confirmar promoção</h3>
                <p id="confirmar-promocao-texto" className="mt-1 text-sm leading-6 text-muted-foreground">
                  Deseja transformar <strong className="text-foreground">{selecionado.nome}</strong> (@{selecionado.usuario}) em moderador? A conta atual e a senha serão mantidas.
                </p>
              </div>
              <button type="button" aria-label="Cancelar promoção" onClick={() => { setSelecionado(null); setErro("") }} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm">
                <X className="size-4" />
              </button>
            </div>
            {erro && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => { setSelecionado(null); setErro("") }} disabled={promovendo}>Cancelar</Button>
              <Button type="button" onClick={confirmarPromocao} disabled={promovendo} className="gap-2">
                <ShieldAlert className="size-4" aria-hidden="true" />
                {promovendo ? "Promovendo…" : "Confirmar promoção"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
