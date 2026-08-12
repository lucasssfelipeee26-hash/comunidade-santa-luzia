export type SantoDoDia = {
  nome: string
  subtitulo?: string
  imagem: string
  chave: string
}

// Calendário local: não depende de internet. As chaves correspondem aos
// documentos/imagens do acervo incorporado do iLiturgia.
const agosto: Record<number, SantoDoDia> = {
  1: { nome: "Santo Afonso Maria de Ligório", imagem: "/santoafonso.jpg", chave: "santoafonso" },
  4: { nome: "São João Maria Vianney", imagem: "/saojoaomariavianney.jpg", chave: "saojoaomariavianney" },
  6: { nome: "Transfiguração do Senhor", imagem: "/transfiguracao.jpg", chave: "transfiguracao" },
  7: { nome: "São Sisto II e companheiros", imagem: "/saosisto.jpg", chave: "saosisto" },
  8: { nome: "São Domingos", imagem: "/saodomingos.jpg", chave: "saodomingos" },
  9: { nome: "Santa Teresa Benedita da Cruz", imagem: "/beneditadacruz.jpg", chave: "beneditadacruz" },
  10: { nome: "São Lourenço", imagem: "/saolourenco.jpg", chave: "saolourenco" },
  11: { nome: "Santa Clara", imagem: "/santaclara.jpg", chave: "santaclara" },
  12: { nome: "Santa Joana Francisca de Chantal", subtitulo: "Religiosa", imagem: "/santajoanadechantal.jpg", chave: "santajoanadechantal" },
  13: { nome: "São Ponciano e Santo Hipólito", imagem: "/poncianoepolito.jpg", chave: "ponciano" },
  14: { nome: "São Maximiliano Maria Kolbe", imagem: "/maximilianokolbe.jpg", chave: "maximilianokolbe" },
  15: { nome: "Assunção de Nossa Senhora", imagem: "/assuncao.jpg", chave: "assuncao" },
  16: { nome: "Santo Estêvão da Hungria", imagem: "/estevaodahungria.jpg", chave: "estevaodahungria" },
  20: { nome: "São Bernardo", imagem: "/saobernardo.jpg", chave: "saobernardo" },
  21: { nome: "São Pio X", imagem: "/saopiox.jpg", chave: "saopiox" },
  22: { nome: "Nossa Senhora Rainha", imagem: "/NSRainha.jpg", chave: "nsrainha" },
  23: { nome: "Santa Rosa de Lima", imagem: "/santarosadelima.jpg", chave: "santarosadelima" },
  24: { nome: "São Bartolomeu", imagem: "/saobartolomeu.jpg", chave: "saobartolomeu" },
  27: { nome: "Santa Mônica", imagem: "/santamonica.jpg", chave: "santamonica" },
  28: { nome: "Santo Agostinho", imagem: "/santoagostinho.jpg", chave: "santoagostinho" },
  29: { nome: "Martírio de São João Batista", imagem: "/martiriosaojoaobatista.jpg", chave: "joaobatista" },
}

export function santoDoDia(data = new Date()): SantoDoDia | null {
  const mes = data.getMonth() + 1
  if (mes === 8) return agosto[data.getDate()] ?? null
  return null
}
