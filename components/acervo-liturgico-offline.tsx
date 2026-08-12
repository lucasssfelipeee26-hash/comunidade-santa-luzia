"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, Library, Loader2, Search, X } from "lucide-react"

type Categoria = { id: string; nome: string; total: number; arquivos: string[] }
type Manifesto = {
  version: number
  offline: boolean
  embedded?: boolean
  preservaHtmlLiturgico?: boolean
  imagensImportadas: boolean
  total: number
  origem: string
  categorias: Categoria[]
}
type Documento = { id: string; path: string; title: string; text?: string; html?: string }
type Pacote = { category: string; documents: Documento[] }

const BASE_EMBUTIDO = "/offline/iliturgia"
const MANIFESTO_EMBUTIDO = `${BASE_EMBUTIDO}/manifest.json`
const CACHE = "santa-luzia-acervo-liturgico-v2"

function arquivoUrl(nome: string) {
  return `${BASE_EMBUTIDO}/${encodeURIComponent(nome)}`
}

async function descompactarJson(resposta: Response): Promise<Pacote> {
  if (!resposta.ok) throw new Error("Documento litúrgico interno não encontrado.")
  if (!("DecompressionStream" in window)) {
    throw new Error("Este aparelho não suporta a leitura do pacote litúrgico.")
  }
  const fluxo = resposta.body?.pipeThrough(new DecompressionStream("gzip"))
  if (!fluxo) throw new Error("Não foi possível abrir o conteúdo litúrgico.")
  return JSON.parse(await new Response(fluxo).text()) as Pacote
}

async function obterArquivoInterno(url: string) {
  try {
    const cache = await caches.open(CACHE)
    const guardada = await cache.match(url)
    if (guardada) return guardada
    const resposta = await fetch(url, { cache: "force-cache" })
    if (resposta.ok) await cache.put(url, resposta.clone())
    return resposta
  } catch {
    return fetch(url, { cache: "force-cache" })
  }
}

function htmlParaBusca(html: string) {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ")
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

function sanitizarHtmlLiturgico(html: string) {
  if (typeof window === "undefined") return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  const permitidos = new Set([
    "DIV", "P", "BR", "SPAN", "FONT", "B", "STRONG", "I", "EM", "U", "SUP", "SUB",
    "H1", "H2", "H3", "H4", "H5", "H6", "CENTER", "BLOCKQUOTE", "HR", "OL", "UL", "LI",
    "TABLE", "TBODY", "THEAD", "TFOOT", "TR", "TD", "TH",
  ])
  const remover: Element[] = []

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (!permitidos.has(el.tagName)) {
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META"].includes(el.tagName)) {
        remover.push(el)
      } else {
        el.replaceWith(...Array.from(el.childNodes))
      }
      continue
    }

    for (const attr of Array.from(el.attributes)) {
      const nome = attr.name.toLowerCase()
      const valor = attr.value.trim()
      const permitido =
        (el.tagName === "FONT" && ["color", "face", "size"].includes(nome)) ||
        (["DIV", "P", "CENTER", "TD", "TH"].includes(el.tagName) && nome === "align") ||
        (["TD", "TH"].includes(el.tagName) && ["colspan", "rowspan"].includes(nome)) ||
        nome === "id" ||
        nome === "class" ||
        nome === "style"

      if (!permitido || nome.startsWith("on")) {
        el.removeAttribute(attr.name)
        continue
      }

      if (nome === "style") {
        const regras = valor.split(";").map((r) => r.trim()).filter(Boolean)
        const seguras = regras.filter((r) => /^(color|text-align|font-weight|font-style|text-decoration|vertical-align)\s*:/i.test(r))
        if (seguras.length) el.setAttribute("style", seguras.join("; "))
        else el.removeAttribute("style")
      }
    }
  }

  remover.forEach((el) => el.remove())
  return doc.body.innerHTML
}

export function AcervoLiturgicoOffline() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null)
  const [categoria, setCategoria] = useState("")
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [busca, setBusca] = useState("")
  const [aberto, setAberto] = useState<Documento | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")

  useEffect(() => {
    obterArquivoInterno(MANIFESTO_EMBUTIDO)
      .then(async (r) => {
        if (!r.ok) throw new Error("O acervo litúrgico interno desta versão está incompleto.")
        const m = await r.json() as Manifesto
        setManifesto(m)
        if (m.categorias.length) setCategoria(m.categorias[0].id)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível abrir o acervo litúrgico."))
  }, [])

  useEffect(() => {
    if (!manifesto || !categoria) return
    const cat = manifesto.categorias.find((c) => c.id === categoria)
    if (!cat) return
    let cancelado = false
    setCarregando(true)
    setErro("")

    Promise.all(cat.arquivos.map(async (arquivo) => descompactarJson(await obterArquivoInterno(arquivoUrl(arquivo)))))
      .then((pacotes) => { if (!cancelado) setDocumentos(pacotes.flatMap((p) => p.documents)) })
      .catch((e) => { if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao abrir esta seção litúrgica.") })
      .finally(() => { if (!cancelado) setCarregando(false) })

    return () => { cancelado = true }
  }, [categoria, manifesto])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR")
    if (!q) return documentos.slice(0, 300)
    return documentos.filter((d) => {
      const conteudo = d.text || (d.html ? htmlParaBusca(d.html) : "")
      return `${d.title} ${d.path} ${conteudo}`.toLocaleLowerCase("pt-BR").includes(q)
    }).slice(0, 300)
  }, [documentos, busca])

  const htmlAberto = useMemo(() => {
    if (!aberto?.html) return ""
    return sanitizarHtmlLiturgico(aberto.html)
  }, [aberto])

  if (aberto) {
    return (
      <article className="rounded-3xl border border-[#d4af37]/35 bg-[#fffdf8] p-4 shadow-sm sm:p-6">
        <button type="button" onClick={() => setAberto(null)} className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold">
          <X className="size-4" /> Fechar documento
        </button>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a731d]">{aberto.path}</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-[#8f182e] sm:text-3xl">{aberto.title}</h2>

        {htmlAberto ? (
          <div
            className="liturgical-document mt-5 text-[1.04rem] leading-8 text-[#2f2924] [&_font[color=red]]:text-[#b42332] [&_sup]:leading-none [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_hr]:my-5 [&_hr]:border-[#d4af37]/30"
            dangerouslySetInnerHTML={{ __html: htmlAberto }}
          />
        ) : (
          <div className="mt-5 whitespace-pre-line text-[1.04rem] leading-8 text-[#2f2924]">{aberto.text}</div>
        )}
      </article>
    )
  }

  return (
    <div>
      <div className="rounded-3xl border border-[#d4af37]/35 bg-white/85 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a731d]">Conteúdo incorporado ao aplicativo</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">Central Litúrgica</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Acervo litúrgico interno organizado por temas. Os documentos preservam rubricas em vermelho, negrito, itálico, números, símbolos e demais indicações presentes no conteúdo autorizado.
        </p>
        {manifesto && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#0b4b35]/10 px-3 py-1.5 font-bold text-[#0b4b35]">{manifesto.total.toLocaleString("pt-BR")} documentos internos</span>
            <span className="rounded-full bg-[#7b1326]/10 px-3 py-1.5 font-bold text-[#7b1326]">Sem imagens</span>
            <span className="rounded-full bg-[#d4af37]/15 px-3 py-1.5 font-bold text-[#755915]">Formatação litúrgica preservada</span>
          </div>
        )}
      </div>

      {erro && <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{erro}</div>}

      {manifesto && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[270px_1fr]">
          <aside className="rounded-2xl border bg-white/80 p-2">
            {manifesto.categorias.map((c) => (
              <button key={c.id} type="button" onClick={() => { setCategoria(c.id); setBusca(""); setAberto(null) }} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${categoria === c.id ? "bg-[#7b1326] text-white" : "hover:bg-black/5"}`}>
                <span className="flex items-center gap-2"><Library className="size-4" />{c.nome}</span><b>{c.total}</b>
              </button>
            ))}
          </aside>

          <section className="rounded-2xl border bg-white/80 p-3 sm:p-4">
            <label className="flex items-center gap-2 rounded-xl border bg-white px-3">
              <Search className="size-4 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar oração, leitura, santo, referência ou palavra…" className="h-12 w-full bg-transparent text-sm outline-none" />
            </label>

            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Abrindo seção…</div>
            ) : (
              <div className="mt-3 grid gap-2">
                {filtrados.map((d) => (
                  <button key={d.id} type="button" onClick={() => setAberto(d)} className="rounded-xl border bg-white p-3 text-left transition hover:border-[#d4af37]">
                    <div className="flex items-start gap-3"><BookOpenText className="mt-0.5 size-5 shrink-0 text-[#8f182e]" /><div className="min-w-0"><h3 className="font-semibold text-[#493e34]">{d.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{d.path}</p></div></div>
                  </button>
                ))}
                {!filtrados.length && <div className="py-12 text-center text-sm text-muted-foreground">Nenhum documento encontrado nesta seção.</div>}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
