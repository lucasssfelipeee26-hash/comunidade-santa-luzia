"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Database, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

type Status = { instalado: boolean; total: number; categorias: number; versao?: number; arquivos?: number }

export function ImportarAcervoLiturgico() {
  const [status, setStatus] = useState<Status | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  async function carregar() {
    const r = await fetch("/api/admin/acervo-liturgico", { cache: "no-store" })
    const j = await r.json().catch(() => null)
    if (r.ok) setStatus(j)
  }

  useEffect(() => { void carregar() }, [])

  async function instalar() {
    if (!arquivo) return
    setEnviando(true)
    setErro("")
    setMensagem("")
    try {
      const form = new FormData()
      form.append("arquivo", arquivo)
      const r = await fetch("/api/admin/acervo-liturgico", { method: "POST", body: form })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.erro || "Não foi possível instalar o pacote.")
      setStatus(j)
      setMensagem(`Acervo instalado: ${Number(j.total).toLocaleString("pt-BR")} documentos em ${j.categorias} categorias.`)
      setArquivo(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao instalar o acervo.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-3xl border border-[#d4af37]/35 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0b4b35] text-[#f2cf62]"><Database className="size-6" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a731d]">Moderador</p>
          <h1 className="font-serif text-3xl font-semibold text-[#7b1326]">Instalar Acervo Litúrgico Offline</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Envie o pacote autorizado no formato .tar. Os arquivos serão gravados no volume persistente do sistema e ficarão disponíveis para todos os usuários baixarem para uso offline.</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border bg-[#fffaf0] p-4">
        {status?.instalado ? <div className="flex items-center gap-3 text-[#0b4b35]"><CheckCircle2 className="size-6" /><div><strong>Acervo instalado</strong><p className="text-sm">{status.total.toLocaleString("pt-BR")} documentos · {status.categorias} categorias · versão {status.versao || 1}</p></div></div> : <p className="text-sm text-muted-foreground">Ainda não há um acervo completo instalado no volume persistente.</p>}
      </div>

      <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d4af37]/55 bg-[#fffdf8] p-5 text-center">
        <Upload className="size-8 text-[#7b1326]" />
        <strong className="mt-2 text-[#7b1326]">Selecionar pacote .tar</strong>
        <span className="mt-1 text-xs text-muted-foreground">Limite de 30 MB</span>
        <input type="file" accept=".tar,application/x-tar" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
        {arquivo && <span className="mt-3 rounded-full bg-[#0b4b35]/10 px-3 py-1.5 text-xs font-bold text-[#0b4b35]">{arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(1)} MB</span>}
      </label>

      {erro && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
      {mensagem && <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}

      <Button onClick={instalar} disabled={!arquivo || enviando} className="mt-4 gap-2">
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {enviando ? "Instalando acervo…" : "Instalar / atualizar acervo"}
      </Button>
    </section>
  )
}
