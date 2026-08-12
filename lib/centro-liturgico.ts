export type HoraCanonica = { id: string; nome: string; horario: string; resumo: string; destaque?: boolean }

export const horasCanonicas: HoraCanonica[] = [
  { id: "invitatorio", nome: "Invitatório", horario: "Início do dia", resumo: "Salmo invitatório e abertura da oração diária." },
  { id: "oficio", nome: "Ofício das Leituras", horario: "Em horário apropriado", resumo: "Salmodia, leitura bíblica e segunda leitura; o APK contém ciclos anual e bienal." },
  { id: "laudes", nome: "Laudes", horario: "Manhã", resumo: "Oração da manhã com hino, salmodia, leitura, cântico evangélico e preces.", destaque: true },
  { id: "terca", nome: "Hora Terça", horario: "Por volta das 9h", resumo: "Hora média da manhã." },
  { id: "sexta", nome: "Hora Sexta", horario: "Por volta das 12h", resumo: "Hora média do meio-dia." },
  { id: "noa", nome: "Hora Nona", horario: "Por volta das 15h", resumo: "Hora média da tarde." },
  { id: "vesperas", nome: "Vésperas", horario: "Fim da tarde", resumo: "Oração da tarde com Magnificat e preces.", destaque: true },
  { id: "completas", nome: "Completas", horario: "Antes de dormir", resumo: "Última oração do dia com exame, salmodia e Cântico de Simeão." },
]

export type ModuloOffline = {
  id: string
  titulo: string
  quantidade: number | string
  descricao: string
  secoes: string[]
  estado: "importado" | "mapeado"
}

export const inventarioOffline: ModuloOffline[] = [
  {
    id: "oficio",
    titulo: "Liturgia das Horas",
    quantidade: "3.749 documentos de texto",
    descricao: "Acervo encontrado no APK em Resources/oficio, organizado pelos tempos litúrgicos e próprios.",
    secoes: ["Invitatório", "Ofício das Leituras", "Ciclo bienal", "Laudes", "Terça", "Sexta", "Nona", "Vésperas", "Completas", "Advento", "Natal", "Quaresma", "Páscoa", "Tempo Comum", "Próprio dos Santos", "Comuns", "Coletas salmódicas"],
    estado: "mapeado",
  },
  {
    id: "lecionario",
    titulo: "Lecionário",
    quantidade: 736,
    descricao: "Documentos de leituras, salmos e Evangelhos do ciclo litúrgico encontrados no APK.",
    secoes: ["Leituras feriais", "Leituras dominicais", "Solenidades e festas", "Próprio dos Santos", "Salmos responsoriais", "Evangelhos"],
    estado: "mapeado",
  },
  {
    id: "evangelho",
    titulo: "Evangelhos / Lectio Divina",
    quantidade: 469,
    descricao: "Coleção separada de Evangelhos do APK para consulta e oração.",
    secoes: ["Evangelho do dia", "Consulta por arquivo", "Lectio Divina"],
    estado: "mapeado",
  },
  {
    id: "missal",
    titulo: "Missal",
    quantidade: 387,
    descricao: "Documentos do Missal presentes no APK, sem imagens.",
    secoes: ["Ordinário da Missa", "Ritos iniciais", "Liturgia da Palavra", "Oração dos fiéis", "Liturgia Eucarística", "Rito da Comunhão", "Ritos finais", "Prefácios", "Orações Eucarísticas I–XI", "Próprio do Tempo", "Próprio dos Santos", "Comuns"],
    estado: "mapeado",
  },
  {
    id: "catequeses",
    titulo: "Catequeses",
    quantidade: 56,
    descricao: "Textos catequéticos encontrados no APK.",
    secoes: ["Salmos", "Cânticos", "Formação para a oração", "Aprofundamento litúrgico"],
    estado: "mapeado",
  },
  {
    id: "comentarios",
    titulo: "Comentários",
    quantidade: 25,
    descricao: "Comentários litúrgicos encontrados no APK.",
    secoes: ["Comentários", "Apoio à meditação"],
    estado: "mapeado",
  },
  {
    id: "rosario",
    titulo: "Rosário",
    quantidade: 4,
    descricao: "Textos dos quatro grupos de mistérios; imagens foram excluídas.",
    secoes: ["Gozosos", "Dolorosos", "Gloriosos", "Luminosos"],
    estado: "importado",
  },
  {
    id: "iglh",
    titulo: "Introdução Geral à Liturgia das Horas",
    quantidade: "1 documento principal",
    descricao: "Documento IGLH identificado na raiz de Resources.",
    secoes: ["Introdução Geral", "Orientações para rezar as Horas"],
    estado: "mapeado",
  },
]

export type MisterioRosario = { grupo: string; dias: string; misterios: Array<{ titulo: string; referencia: string }> }
export const misteriosRosario: MisterioRosario[] = [
  { grupo: "Gozosos", dias: "segunda-feira e sábado", misterios: [
    { titulo: "Anunciação do Senhor", referencia: "Lc 1,26-38" }, { titulo: "Visitação de Maria a Isabel", referencia: "Lc 1,39-56" }, { titulo: "Nascimento de Jesus", referencia: "Lc 2,1-20" }, { titulo: "Apresentação de Jesus no Templo", referencia: "Lc 2,22-40" }, { titulo: "Jesus entre os doutores", referencia: "Lc 2,41-52" },
  ]},
  { grupo: "Dolorosos", dias: "terça-feira e sexta-feira", misterios: [
    { titulo: "Agonia de Jesus no Horto", referencia: "Mt 26,36-46" }, { titulo: "Flagelação de Jesus", referencia: "Jo 19,1" }, { titulo: "Coroação de espinhos", referencia: "Mt 27,27-31" }, { titulo: "Jesus carrega a Cruz", referencia: "Lc 23,26-32" }, { titulo: "Crucificação e morte de Jesus", referencia: "Jo 19,25-30" },
  ]},
  { grupo: "Gloriosos", dias: "quarta-feira e domingo", misterios: [
    { titulo: "Ressurreição do Senhor", referencia: "Mt 28,1-10" }, { titulo: "Ascensão do Senhor", referencia: "At 1,6-11" }, { titulo: "Vinda do Espírito Santo", referencia: "At 2,1-13" }, { titulo: "Assunção de Maria", referencia: "cf. Ap 12,1" }, { titulo: "Coroação de Maria", referencia: "cf. Ap 12,1" },
  ]},
  { grupo: "Luminosos", dias: "quinta-feira", misterios: [
    { titulo: "Batismo de Jesus", referencia: "Mt 3,13-17" }, { titulo: "Bodas de Caná", referencia: "Jo 2,1-12" }, { titulo: "Anúncio do Reino de Deus", referencia: "Mc 1,14-15" }, { titulo: "Transfiguração", referencia: "Lc 9,28-36" }, { titulo: "Instituição da Eucaristia", referencia: "Lc 22,14-20" },
  ]},
]

export const recursosCentro = [
  { id: "liturgia", titulo: "Liturgia de Hoje", descricao: "Leituras, Salmo e Evangelho carregados somente da base offline da data." },
  { id: "horas", titulo: "Liturgia das Horas", descricao: "As Horas reais existentes no acervo do APK: Invitatório, Ofício, Laudes, Horas Médias, Vésperas e Completas." },
  { id: "acervo", titulo: "Acervo Offline", descricao: "Inventário real dos documentos extraídos/mapeados do APK, sem imagens e sem links para fontes online." },
  { id: "rosario", titulo: "Santo Rosário", descricao: "Mistérios e acompanhamento da oração." },
  { id: "calendario", titulo: "Calendário Litúrgico", descricao: "Tempos e ciclos usados para selecionar o conteúdo offline correto." },
  { id: "leitura", titulo: "Modo de Leitura", descricao: "Tamanho de fonte e modo noturno." },
]
