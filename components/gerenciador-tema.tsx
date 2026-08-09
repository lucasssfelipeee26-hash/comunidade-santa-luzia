"use client"

import { useMemo, useState } from "react"
import { Check, Palette, RotateCcw, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { temasSantaLuzia, type TemaSite } from "@/lib/site-theme-shared"

export function GerenciadorTema({ temaInicial }: { temaInicial: TemaSite }) {
  const router = useRouter()
  const [temaSalvo, setTemaSalvo] = useState<TemaSite>(temaInicial)
  const [temaSelecionado, setTemaSelecionado] = useState<TemaSite>(temaInicial)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  const temaPreview = useMemo(
    () => temasSantaLuzia.find((tema) => tema.id === temaSelecionado) ?? temasSantaLuzia[0],
    [temaSelecionado],
  )

  function visualizar(tema: TemaSite) {
    setTemaSelecionado(tema)
    setMensagem("")
    setErro("")
  }

  function desfazerPrevia() {
    setTemaSelecionado(temaSalvo)
    setMensagem("Seleção restaurada para o tema atualmente salvo.")
    setErro("")
  }

  async function salvar() {
    setSalvando(true)
    setMensagem("")
    setErro("")

    try {
      const resposta = await fetch("/api/configuracao/tema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: temaSelecionado }),
      })
      const dados = (await resposta.json().catch(() => ({}))) as { ok?: boolean; erro?: string }
      if (!resposta.ok || !dados.ok) throw new Error(dados.erro || "Não foi possível salvar o tema.")

      setTemaSalvo(temaSelecionado)
      setMensagem("Tema salvo. A nova paleta agora vale para o site público; a Área Restrita continua clara.")
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar o tema.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Palette className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-primary">Escolha a identidade de cores</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              A escolha altera somente o site público. A Área Restrita permanece sempre branca e clara, com texto de alto contraste.
              Selecione uma opção, confira a prévia abaixo e depois salve.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: temaPreview.cores[2] }}>
        <div className="px-5 py-4 text-white" style={{ backgroundColor: temaPreview.cores[0] }}>
          <p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: temaPreview.cores[2] }}>Prévia do site público</p>
          <p className="mt-1 font-serif text-2xl font-semibold" style={{ color: temaPreview.cores[2] }}>Comunidade Santa Luzia</p>
          <p className="mt-1 text-sm text-white/85">Acólitos e Coroinhas São Padre Pio</p>
        </div>
        <div className="p-5" style={{ backgroundColor: temaPreview.cores[3] }}>
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: temaPreview.cores[2] }}>
            <p className="font-serif text-xl font-semibold" style={{ color: temaPreview.cores[0] }}>{temaPreview.nome}</p>
            <p className="mt-1 text-sm text-neutral-600">{temaPreview.descricao}</p>
            <span className="mt-4 inline-flex rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: temaPreview.cores[0], color: "#fff" }}>Botão de exemplo</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {temasSantaLuzia.map((tema) => {
          const selecionado = temaSelecionado === tema.id
          const salvo = temaSalvo === tema.id
          return (
            <button
              key={tema.id}
              type="button"
              onClick={() => visualizar(tema.id)}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                selecionado ? "border-primary ring-2 ring-primary/15" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl font-semibold text-foreground">{tema.nome}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{tema.descricao}</p>
                </div>
                {selecionado && (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className="mt-5 flex gap-2" aria-label={`Cores do tema ${tema.nome}`}>
                {tema.cores.map((cor) => (
                  <span key={cor} className="h-10 flex-1 rounded-lg border border-black/10 shadow-inner" style={{ backgroundColor: cor }} title={cor} />
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="font-medium text-primary">{selecionado ? "Selecionado" : "Ver prévia"}</span>
                {salvo && <span className="rounded-full bg-accent/20 px-2 py-1 font-semibold text-accent-foreground">Tema atual</span>}
              </div>
            </button>
          )
        })}
      </div>

      {(mensagem || erro) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${erro ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`} role="status">
          {erro || mensagem}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={desfazerPrevia}
          disabled={temaSelecionado === temaSalvo || salvando}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Voltar ao tema salvo
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={temaSelecionado === temaSalvo || salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" aria-hidden="true" />
          {salvando ? "Salvando..." : "Salvar tema"}
        </button>
      </div>
    </div>
  )
}
