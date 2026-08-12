"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, CheckCircle2, HardDriveDownload, Library, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Categoria = { id: string; nome: string; total: number; arquivos: string[] }
type Manifesto = { version: number; offline: boolean; imagensImportadas: boolean; total: number; origem: string; categorias: Categoria[] }
type Documento = { id: string; path: string; title: string; text: string }
type Pacote = { category: string; documents: Documento[] }

const MANIFESTO_URL = "/api/acervo-liturgico/manifest"
const arquivoUrl = (nome: string) => `/api/acervo-liturgico/arquivo?nome=${encodeURIComponent(nome)}`
const CACHE = "santa-luzia-acervo-liturgico-v1"

async function descompactarJson(resposta: Response): Promise<Pacote> {
  if (!resposta.ok) throw new Error("Pacote não encontrado.")
  if (!("DecompressionStream" in window)) throw new Error("Este navegador não suporta a descompactação offline do acervo.")
  const fluxo = resposta.body?.pipeThrough(new DecompressionStream("gzip"))
  if (!fluxo) throw new Error("Não foi possível abrir o pacote.")
  const texto = await new Response(fluxo).text()
  return JSON.parse(texto) as Pacote
}

async function obterResposta(url: string) {
  const cache = await caches.open(CACHE)
  const guardada = await cache.match(url)
  if (guardada) return guardada
  const resposta = await fetch(url, { cache: "no-store" })
  if (resposta.ok) await cache.put(url, resposta.clone())
  return resposta
}

export function AcervoLiturgicoOffline() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null)
  const [categoria, setCategoria] = useState("")
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [busca, setBusca] = useState("")
  const [aberto, setAberto] = useState<Documento | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [offlinePronto, setOfflinePronto] = useState(false)
  const [erro, setErro] = useState("")

  useEffect(() => {
    obterResposta(MANIFESTO_URL)
      .then(async (r) => {
        if (!r.ok) throw new Error("O acervo completo ainda não foi instalado pelo moderador.")
        const m = await r.json() as Manifesto
        setManifesto(m)
        if (m.categorias.length) setCategoria(m.categorias[0].id)
        try {
          const cache = await caches.open(CACHE)
          const urls = m.categorias.flatMap((c) => c.arquivos.map(arquivoUrl))
          const checks = await Promise.all(urls.map((u) => cache.match(u)))
          setOfflinePronto(checks.every(Boolean))
        } catch {}
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível abrir o acervo."))
  }, [])

  useEffect(() => {
    if (!manifesto || !categoria) return
    const cat = manifesto.categorias.find((c) => c.id === categoria)
    if (!cat) return
    let cancelado = false
    setCarregando(true)
    setErro("")
    Promise.all(cat.arquivos.map(async (arquivo) => descompactarJson(await obterResposta(arquivoUrl(arquivo)))))
      .then((pacotes) => { if (!cancelado) setDocumentos(pacotes.flatMap((p) => p.documents)) })
      .catch((e) => { if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao abrir a categoria.") })
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [categoria, manifesto])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR")
    if (!q) return documentos.slice(0, 300)
    return documentos.filter((d) => `${d.title} ${d.path} ${d.text}`.toLocaleLowerCase("pt-BR").includes(q)).slice(0, 300)
  }, [documentos, busca])

  async function baixarTudo() {
    if (!manifesto) return
    setBaixando(true)
    setErro("")
    setProgresso(0)
    try {
      const arquivos = manifesto.categorias.flatMap((c) => c.arquivos)
      const cache = await caches.open(CACHE)
      for (let i = 0; i < arquivos.length; i++) {
        const url = arquivoUrl(arquivos[i])
        if (!await cache.match(url)) {
          const resposta = await fetch(url, { cache: "no-store" })
          if (!resposta.ok) throw new Error(`O pacote ${arquivos[i]} ainda não está disponível.`)
          await cache.put(url, resposta.clone())
        }
        setProgresso(Math.round(((i + 1) / arquivos.length) * 100))
      }
      const manifestResp = await fetch(MANIFESTO_URL, { cache: "no-store" })
      if (manifestResp.ok) await cache.put(MANIFESTO_URL, manifestResp.clone())
      setOfflinePronto(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível baixar o acervo.")
    } finally {
      setBaixando(false)
    }
  }

  if (aberto) {
    return <article className="rounded-3xl border border-[#d4af37]/35 bg-white/90 p-4 shadow-sm sm:p-6">
      <button type="button" onClick={() => setAberto(null)} className="mb-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><X className="size-4" /> Fechar documento</button>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a731d]">{aberto.path}</p>
      <h2 className="mt-2 font-serif text-2xl font-semibold text-[#8f182e] sm:text-3xl">{aberto.title}</h2>
      <div className="mt-5 whitespace-pre-line text-[1.02rem] leading-8 text-[#413a32]">{aberto.text}</div>
    </article>
  }

  return <div>
    <div className="rounded-3xl border border-[#d4af37]/35 bg-white/85 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a731d]">Biblioteca instalada no aplicativo</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Acervo Litúrgico Offline</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Documentos extraídos do acervo autorizado, sem imagens. Depois de baixar o acervo, os textos permanecem disponíveis no aparelho mesmo sem internet.</p>
        </div>
        <Button onClick={baixarTudo} disabled={baixando || !manifesto} className="gap-2">
          {baixando ? <Loader2 className="size-4 animate-spin" /> : offlinePronto ? <CheckCircle2 className="size-4" /> : <HardDriveDownload className="size-4" />}
          {baixando ? `Baixando ${progresso}%` : offlinePronto ? "Acervo disponível offline" : "Baixar acervo offline"}
        </Button>
      </div>
      {manifesto && <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#0b4b35]/10 px-3 py-1.5 font-bold text-[#0b4b35]">{manifesto.total.toLocaleString("pt-BR")} documentos</span><span className="rounded-full bg-[#7b1326]/10 px-3 py-1.5 font-bold text-[#7b1326]">Sem imagens</span><span className="rounded-full bg-[#d4af37]/15 px-3 py-1.5 font-bold text-[#755915]">Uso offline</span></div>}
    </div>

    {erro && <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{erro}</div>}

    {manifesto && <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl border bg-white/80 p-2">
        {manifesto.categorias.map((c) => <button key={c.id} type="button" onClick={() => { setCategoria(c.id); setBusca("") }} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${categoria === c.id ? "bg-[#7b1326] text-white" : "hover:bg-black/5"}`}><span className="flex items-center gap-2"><Library className="size-4" />{c.nome}</span><b>{c.total}</b></button>)}
      </aside>
      <section className="rounded-2xl border bg-white/80 p-3 sm:p-4">
        <label className="flex items-center gap-2 rounded-xl border bg-white px-3"><Search className="size-4 text-muted-foreground" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar título, referência ou palavra no texto…" className="h-12 w-full bg-transparent text-sm outline-none" /></label>
        {carregando ? <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Abrindo documentos…</div> : <div className="mt-3 grid gap-2">{filtrados.map((d) => <button key={d.id} type="button" onClick={() => setAberto(d)} className="rounded-xl border bg-white p-3 text-left transition hover:border-[#d4af37]"><div className="flex items-start gap-3"><BookOpenText className="mt-0.5 size-5 shrink-0 text-[#8f182e]" /><div className="min-w-0"><h3 className="font-semibold text-[#493e34]">{d.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{d.path}</p></div></div></button>)}{!filtrados.length && <div className="py-12 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</div>}</div>}
      </section>
    </div>}
  </div>
}
