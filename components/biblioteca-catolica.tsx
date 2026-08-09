"use client"

import { useMemo, useState } from "react"
import { BookOpen, Download, ExternalLink, Search, ShieldCheck } from "lucide-react"
import { categoriasBiblioteca, livrosBiblioteca, type LivroBiblioteca } from "@/lib/biblioteca"

function CoverFallback({ livro }: { livro: LivroBiblioteca }) {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(145deg,#073b29,#0b5a3f_58%,#082d21)] p-3 text-white">
      <div className="flex size-8 items-center justify-center rounded-full border border-[#d4af37]/70 bg-black/10 text-[#f2cf62]">
        <BookOpen className="size-4" />
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-[.18em] text-[#e9c75b]">Biblioteca Católica</p>
        <p className="mt-2 font-serif text-base leading-tight text-white">{livro.titulo}</p>
        <p className="mt-2 text-[10px] leading-4 text-white/70">{livro.santo || livro.autor}</p>
      </div>
    </div>
  )
}

function BookCover({ livro }: { livro: LivroBiblioteca }) {
  const [falhou, setFalhou] = useState(false)
  if (!livro.capa || falhou) return <CoverFallback livro={livro} />

  return (
    <img
      src={livro.capa}
      alt={`Capa ou imagem de ${livro.santo || livro.titulo}`}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(true)}
    />
  )
}

function LivroCard({ livro }: { livro: LivroBiblioteca }) {
  return (
    <article className="group flex overflow-hidden rounded-xl border border-[#d9cfb9] bg-[#fffdf7] shadow-[0_7px_20px_rgba(72,55,21,.07)] transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md">
      <div className="relative h-[158px] w-[92px] shrink-0 overflow-hidden bg-[#0b4b35] sm:h-[168px] sm:w-[98px]">
        <BookCover livro={livro} />
        {livro.destaque && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[#d4af37] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-[#073b29]">Destaque</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#9a731d]">{livro.categoria}</p>
        <h3 className="mt-1 font-serif text-[17px] leading-tight text-[#173d2d]">{livro.titulo}</h3>
        {livro.subtitulo && <p className="mt-1 line-clamp-1 text-[11px] font-medium text-[#486354]">{livro.subtitulo}</p>}
        <p className="mt-1.5 line-clamp-1 text-[11px] text-[#665f50]"><strong>Autor:</strong> {livro.autor}</p>

        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[#786f60]">
          {livro.edicao && <span className="rounded-full bg-[#f1eadb] px-2 py-0.5">{livro.edicao}</span>}
          {livro.paginas && <span className="rounded-full bg-[#f1eadb] px-2 py-0.5">{livro.paginas} págs.</span>}
          {livro.periodo && <span className="rounded-full bg-[#f1eadb] px-2 py-0.5">{livro.periodo}</span>}
        </div>

        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#625c50]">{livro.descricao}</p>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <a href={livro.downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md bg-[#073b29] px-2 py-2 text-[10px] font-semibold text-white transition hover:bg-[#0b5a3f]">
            <Download className="size-3.5" /> {livro.downloadDireto ? "Baixar" : "Abrir"}
          </a>
          <a href={livro.fonteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 rounded-md border border-[#b98b22] px-2 py-2 text-[10px] font-semibold text-[#765711] transition hover:bg-[#f3ead5]">
            <ExternalLink className="size-3.5" /> Fonte
          </a>
        </div>
      </div>
    </article>
  )
}

export function BibliotecaCatolica() {
  const [busca, setBusca] = useState("")
  const [categoria, setCategoria] = useState<(typeof categoriasBiblioteca)[number]>("Todos")

  const livros = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR")
    return livrosBiblioteca.filter((livro) => {
      const categoriaOk = categoria === "Todos" || livro.categoria === categoria
      const texto = [livro.titulo, livro.subtitulo, livro.autor, livro.santo, livro.categoria]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
      return categoriaOk && (!q || texto.includes(q))
    })
  }, [busca, categoria])

  const santos = livros.filter((livro) => livro.categoria === "Santos e Santas")
  const outras = livros.filter((livro) => livro.categoria !== "Santos e Santas")

  const renderGrupo = (titulo: string, itens: LivroBiblioteca[]) => {
    if (!itens.length) return null
    return (
      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-[#d9cfb9] pb-2">
          <div>
            <h2 className="font-serif text-2xl text-[#173d2d]">{titulo}</h2>
            <p className="text-xs text-[#817867]">{itens.length} obra(s)</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((livro) => <LivroCard key={livro.id} livro={livro} />)}
        </div>
      </section>
    )
  }

  return (
    <div>
      <section className="rounded-2xl border border-[#d4af37]/35 bg-[#073b29] p-6 text-white shadow-lg sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e9c75b]">Acervo para estudo e formação</p>
            <h1 className="mt-2 font-serif text-4xl text-[#f2cf62] sm:text-5xl">Biblioteca Católica</h1>
            <p className="mt-4 max-w-3xl leading-7 text-white/80">Agora com mais livros, capas menores e categorias organizadas. Quando uma obra não possui imagem original adequada, o site usa uma capa católica gerada localmente para manter o visual bonito e uniforme.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/45 bg-white/5 px-4 py-3 text-sm text-white/80">
            <ShieldCheck className="size-5 text-[#f2cf62]" /> Catálogo com referência à fonte original
          </div>
        </div>
      </section>

      <div className="mt-7 rounded-xl border border-[#d9cfb9] bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#8b806a]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar livro, autor, santo ou tema..." className="w-full rounded-lg border border-[#d9cfb9] bg-[#fffdf7] py-3 pl-11 pr-4 text-[#173d2d] outline-none transition focus:border-[#b98b22] focus:ring-2 focus:ring-[#d4af37]/20" />
        </label>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Categorias da biblioteca">
          {categoriasBiblioteca.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategoria(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${categoria === item ? "border-[#073b29] bg-[#073b29] text-white" : "border-[#d9cfb9] bg-[#fffdf7] text-[#486354] hover:border-[#b98b22] hover:text-[#765711]"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-[#6b6455]"><strong className="text-[#173d2d]">{livros.length}</strong> obra(s) encontrada(s)</p>
        <p className="hidden text-xs text-[#8a816f] sm:block">Capas menores e otimizadas para carregar mais rápido.</p>
      </div>

      {categoria === "Todos" ? (
        <>
          {renderGrupo("Santos e Santas", santos)}
          {renderGrupo("Outras Obras", outras)}
        </>
      ) : (
        renderGrupo(categoria, livros)
      )}

      {livros.length === 0 && <div className="mt-8 rounded-xl border border-dashed border-[#d4af37] bg-[#fffdf7] p-10 text-center text-[#6b6455]">Nenhuma obra encontrada com esses filtros.</div>}

      <aside className="mt-10 rounded-xl border border-[#d4af37]/35 bg-[#f6efdf] p-6 text-sm leading-6 text-[#625c50]">
        <strong className="text-[#173d2d]">Sobre os downloads:</strong> os PDFs não são copiados para o servidor da Comunidade Santa Luzia. Quando houver link direto, o botão abre a hospedagem original; nos demais casos, ele abre a página da obra no Alexandria Católica, onde o download é disponibilizado pela fonte.
      </aside>
    </div>
  )
}
