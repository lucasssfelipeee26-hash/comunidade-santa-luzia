"use client"

import { useEffect, useState } from "react"
import { CirclePlus, Pencil, Save, Trash2 } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"

type PerguntaEdit = {
  id: string
  enunciado: string
  opcoes: string[]
  correta: number
  pontos: number
  explicacao: string
}

const letras = ["A", "B", "C"]
const novaPergunta = (): PerguntaEdit => ({
  id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  enunciado: "",
  opcoes: ["", "", ""],
  correta: -1,
  pontos: 10,
  explicacao: "",
})

export function GerenciadorRanking() {
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")
  const [msg, setMsg] = useState("")
  const [quizId, setQuizId] = useState("")
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [ativo, setAtivo] = useState(true)
  const [perguntas, setPerguntas] = useState<PerguntaEdit[]>([novaPergunta()])

  async function carregar() {
    setCarregando(true)
    setErro("")
    try {
      const r = await fetch("/api/quizzes?admin=1", { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Erro ao carregar os quizzes.")
      setQuizzes(j.quizzes || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar os quizzes.")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  function limpar() {
    setQuizId("")
    setTitulo("")
    setDescricao("")
    setAtivo(true)
    setPerguntas([novaPergunta()])
  }

  function editar(q: any) {
    setQuizId(q.id)
    setTitulo(q.titulo)
    setDescricao(q.descricao || "")
    setAtivo(q.ativo !== false)
    setPerguntas((q.perguntas || []).map((p: any) => ({
      ...p,
      opcoes: [...(p.opcoes || [])].slice(0, 3).concat(Array(Math.max(0, 3 - (p.opcoes || []).length)).fill("")),
      correta: Number.isInteger(p.correta) ? p.correta : -1,
      pontos: Number(p.pontos) || 10,
      explicacao: p.explicacao || "",
    })))
  }

  async function salvar() {
    setErro("")
    setMsg("")
    const incompleta = perguntas.some((p) => !p.enunciado.trim() || p.opcoes.some((o) => !o.trim()) || p.correta < 0)
    if (!titulo.trim() || incompleta) {
      setErro("Preencha o título, a pergunta, as alternativas A/B/C e marque uma delas como Verdadeira.")
      return
    }

    const r = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quizId || undefined, titulo, descricao, origem: "manual", ativo, perguntas }),
    })
    const j = await r.json()
    if (!r.ok) { setErro(j.erro || "Erro ao salvar quiz."); return }
    setMsg(quizId ? "Quiz alterado com sucesso." : "Quiz publicado com sucesso.")
    limpar()
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este quiz e as respostas dele?")) return
    const r = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "excluir", id }),
    })
    if (!r.ok) { setErro("Não foi possível excluir."); return }
    setMsg("Quiz excluído.")
    await carregar()
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8e6,#fff_48%,#faf7f2)]">
      <AreaHeader titulo="Gerenciar Quiz" subtitulo="Crie e gerencie exclusivamente os quizzes da competição" voltarHref="/area-restrita/moderador" menu={<ModeradorMenu />} />
      <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-8">
        {erro && <div className="mb-4 rounded-2xl border border-destructive/25 bg-white/80 p-3 text-sm text-destructive backdrop-blur-xl">{erro}</div>}
        {msg && <div className="mb-4 rounded-2xl border border-accent/40 bg-white/80 p-3 text-sm backdrop-blur-xl">{msg}</div>}

        <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-xl backdrop-blur-2xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-primary">{quizId ? "Alterar quiz" : "Novo quiz avulso"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Cada pergunta terá três alternativas. Marque exatamente uma como Verdadeira; as outras ficam Falsas.</p>
            </div>
            {quizId && <Button variant="outline" onClick={limpar}>Cancelar</Button>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do quiz" className="h-11 rounded-xl border border-border bg-white px-3" />
            <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Publicado / ativo</label>
          </div>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição curta (opcional)" className="mt-3 min-h-20 w-full rounded-xl border border-border bg-white p-3" />

          <div className="mt-5 space-y-4">
            {perguntas.map((p, i) => (
              <div key={p.id} className="rounded-2xl border border-accent/35 bg-white/85 p-4 shadow-sm">
                <div className="flex items-center">
                  <strong className="text-primary">Pergunta {i + 1}</strong>
                  <button type="button" className="ml-auto text-destructive" disabled={perguntas.length === 1} onClick={() => setPerguntas((old) => old.filter((_, k) => k !== i))}><Trash2 className="size-4" /></button>
                </div>
                <input value={p.enunciado} onChange={(e) => setPerguntas((old) => old.map((x, k) => k === i ? { ...x, enunciado: e.target.value } : x))} placeholder="Escreva a pergunta aqui" className="mt-3 h-11 w-full rounded-xl border border-border px-3" />

                <div className="mt-3 grid gap-3">
                  {p.opcoes.map((op, j) => {
                    const verdadeira = p.correta === j
                    return (
                      <div key={j} className={`rounded-2xl border p-3 ${verdadeira ? "border-primary/45 bg-primary/5" : "border-border bg-white"}`}>
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary font-bold text-primary">{letras[j]}</span>
                          <input value={op} onChange={(e) => setPerguntas((old) => old.map((x, k) => k === i ? { ...x, opcoes: x.opcoes.map((o, z) => z === j ? e.target.value : o) } : x))} placeholder={`Alternativa ${letras[j]}`} className="h-10 min-w-0 flex-1 rounded-lg border border-border px-2" />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setPerguntas((old) => old.map((x, k) => k === i ? { ...x, correta: j } : x))} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${verdadeira ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground"}`}>✓ Verdadeira</button>
                          <button type="button" onClick={() => setPerguntas((old) => old.map((x, k) => k === i && x.correta === j ? { ...x, correta: -1 } : x))} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${!verdadeira ? "border-border bg-secondary/60 text-foreground" : "border-border bg-white text-muted-foreground"}`}>✕ Falsa</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">Status: {p.correta >= 0 ? `Alternativa ${letras[p.correta]} marcada como Verdadeira` : "nenhuma alternativa marcada como Verdadeira"}.</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPerguntas((old) => [...old, novaPergunta()])} className="gap-2"><CirclePlus className="size-4" />Adicionar pergunta</Button>
            <Button onClick={salvar} className="gap-2"><Save className="size-4" />{quizId ? "Salvar alterações" : "Publicar quiz"}</Button>
          </div>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="font-serif text-xl font-semibold text-primary">Quizzes publicados</h3>
          {carregando && <p className="rounded-2xl bg-white/75 p-4 text-muted-foreground">Carregando quizzes…</p>}
          {!carregando && quizzes.length === 0 && <p className="rounded-2xl bg-white/75 p-4 text-muted-foreground">Nenhum quiz avulso.</p>}
          {quizzes.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 backdrop-blur-xl">
              <div className="min-w-0 flex-1"><p className="font-semibold">{q.titulo}</p><p className="text-xs text-muted-foreground">{q.perguntas?.length || 0} pergunta(s) · {q.ativo ? "ativo" : "inativo"}</p></div>
              <Button size="sm" variant="outline" onClick={() => editar(q)} className="gap-1"><Pencil className="size-4" />Alterar</Button>
              <Button size="sm" variant="destructive" onClick={() => excluir(q.id)} className="gap-1"><Trash2 className="size-4" />Excluir</Button>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
