"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ClipboardPlus, ShieldCheck } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HighContrastSelect } from "@/components/ui/high-contrast-select"
import { useStore } from "@/lib/store"

type TipoRegistro = "advertencias" | "faltas" | "observacoes"

const tipos: { valor: TipoRegistro; label: string; placeholder: string }[] = [
  { valor: "advertencias", label: "Advertência", placeholder: "Descreva a advertência…" },
  { valor: "faltas", label: "Falta", placeholder: "Ex.: Missa de sábado — sem aviso." },
  { valor: "observacoes", label: "Observação", placeholder: "Anote uma observação…" },
]

function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function NovoRegistroModerador() {
  const { membros, adicionarRegistro } = useStore()
  const ativos = useMemo(() => membros.filter((m) => m.status === "aprovado"), [membros])
  const [membroId, setMembroId] = useState("")
  const [tipo, setTipo] = useState<TipoRegistro>("advertencias")
  const [data, setData] = useState(hojeISO())
  const [descricao, setDescricao] = useState("")
  const [salvo, setSalvo] = useState(false)

  const placeholder = tipos.find((item) => item.valor === tipo)?.placeholder ?? ""

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!membroId || !data || descricao.trim().length < 3) return
    adicionarRegistro(membroId, tipo, data, descricao.trim())
    setDescricao("")
    setSalvo(true)
    window.setTimeout(() => setSalvo(false), 3500)
  }

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader
        titulo="Novo Registro"
        subtitulo="Advertências, faltas e observações dos membros"
        voltarHref="/area-restrita/moderador"
        voltarLabel="Voltar ao painel"
        menu={<ModeradorMenu />}
        badge={
          <Badge className="gap-1.5 bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" /> Moderador
          </Badge>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-primary/30 bg-white shadow-sm">
          <header className="border-b border-border bg-primary/5 px-5 py-4">
            <h2 className="flex items-center gap-2 font-serif text-2xl text-primary">
              <ClipboardPlus className="size-5" /> Registrar ocorrência
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha o membro e o tipo de registro. As justificativas continuam sendo enviadas pelo próprio membro.</p>
          </header>

          <form onSubmit={salvar} className="space-y-5 p-5">
            <div className="space-y-2">
              <Label htmlFor="membro-registro">Membro</Label>
              <HighContrastSelect
                id="membro-registro"
                value={membroId}
                onValueChange={setMembroId}
                required
                dialogTitle="Selecionar acólito ou coroinha"
                placeholder="Selecione um acólito ou coroinha"
                options={ativos.map((membro) => ({
                  value: membro.id,
                  label: membro.nome,
                  description: membro.funcao,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de registro</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {tipos.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    onClick={() => setTipo(item.valor)}
                    aria-pressed={tipo === item.valor}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      tipo === item.valor
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[190px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="data-registro">Data</Label>
                <Input id="data-registro" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao-registro">Descrição</Label>
                <Input
                  id="descricao-registro"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={placeholder}
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="gap-2" disabled={ativos.length === 0}>
                <ClipboardPlus className="size-4" /> Adicionar registro
              </Button>
              {salvo && (
                <span className="inline-flex items-center gap-1.5 text-sm text-[oklch(0.45_0.08_160)]">
                  <CheckCircle2 className="size-4" /> Registro adicionado.
                </span>
              )}
            </div>

            {ativos.length === 0 && <p className="text-sm text-muted-foreground">Não há membros aprovados para receber registros.</p>}
          </form>
        </section>
      </main>
    </div>
  )
}
