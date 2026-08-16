import { NextResponse } from "next/server"
import { livrosBiblioteca } from "@/lib/biblioteca"

export async function GET() {
  return NextResponse.json({
    livros: livrosBiblioteca.map((livro) => ({
      id: livro.id,
      titulo: livro.titulo,
      subtitulo: livro.subtitulo || null,
      autor: livro.autor,
      categoria: livro.categoria,
      santo: livro.santo || null,
      paginas: livro.paginas || null,
      edicao: livro.edicao || null,
      periodo: livro.periodo || null,
      descricao: livro.descricao,
      downloadUrl: livro.downloadUrl,
      fonteUrl: livro.fonteUrl,
      hospedagem: livro.hospedagem,
      destaque: Boolean(livro.destaque),
      downloadDireto: Boolean(livro.downloadDireto),
    })),
  }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } })
}
