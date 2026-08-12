export type HoraCanonica = {
  id: string
  nome: string
  horario: string
  resumo: string
  destaque?: boolean
}

export const horasCanonicas: HoraCanonica[] = [
  { id: "invitatorio", nome: "Invitatório", horario: "Início do dia", resumo: "Abertura orante do dia e convite ao louvor." },
  { id: "oficio", nome: "Ofício das Leituras", horario: "Em horário apropriado", resumo: "Salmodia e leituras bíblica e patrística/espiritual, com ciclos anual e bienal." },
  { id: "laudes", nome: "Laudes", horario: "Manhã", resumo: "Oração da manhã, ação de graças e entrega do novo dia.", destaque: true },
  { id: "terca", nome: "Hora Terça", horario: "Por volta das 9h", resumo: "Breve pausa de oração no início das atividades." },
  { id: "sexta", nome: "Hora Sexta", horario: "Por volta das 12h", resumo: "Oração no meio do dia e memória da Paixão do Senhor." },
  { id: "noa", nome: "Hora Nona", horario: "Por volta das 15h", resumo: "Oração da tarde, tradicionalmente ligada à hora da morte de Cristo." },
  { id: "vesperas", nome: "Vésperas", horario: "Fim da tarde", resumo: "Ação de graças pelo dia que termina.", destaque: true },
  { id: "completas", nome: "Completas", horario: "Antes de dormir", resumo: "Última oração do dia, marcada por exame, confiança e repouso em Deus." },
]

export type MisterioRosario = {
  grupo: string
  dias: string
  cor: string
  misterios: Array<{ titulo: string; referencia: string }>
}

export const misteriosRosario: MisterioRosario[] = [
  {
    grupo: "Gozosos",
    dias: "segunda-feira e sábado",
    cor: "Dourado",
    misterios: [
      { titulo: "Anunciação do Senhor", referencia: "Lc 1,26-38" },
      { titulo: "Visitação de Maria a Isabel", referencia: "Lc 1,39-56" },
      { titulo: "Nascimento de Jesus", referencia: "Lc 2,1-20" },
      { titulo: "Apresentação de Jesus no Templo", referencia: "Lc 2,22-40" },
      { titulo: "Jesus entre os doutores", referencia: "Lc 2,41-52" },
    ],
  },
  {
    grupo: "Dolorosos",
    dias: "terça-feira e sexta-feira",
    cor: "Vermelho",
    misterios: [
      { titulo: "Agonia de Jesus no Horto", referencia: "Mt 26,36-46" },
      { titulo: "Flagelação de Jesus", referencia: "Jo 19,1" },
      { titulo: "Coroação de espinhos", referencia: "Mt 27,27-31" },
      { titulo: "Jesus carrega a Cruz", referencia: "Lc 23,26-32" },
      { titulo: "Crucificação e morte de Jesus", referencia: "Jo 19,25-30" },
    ],
  },
  {
    grupo: "Gloriosos",
    dias: "quarta-feira e domingo",
    cor: "Branco",
    misterios: [
      { titulo: "Ressurreição do Senhor", referencia: "Mt 28,1-10" },
      { titulo: "Ascensão do Senhor", referencia: "At 1,6-11" },
      { titulo: "Vinda do Espírito Santo", referencia: "At 2,1-13" },
      { titulo: "Assunção de Maria", referencia: "cf. Ap 12,1" },
      { titulo: "Coroação de Maria", referencia: "cf. Ap 12,1" },
    ],
  },
  {
    grupo: "Luminosos",
    dias: "quinta-feira",
    cor: "Azul",
    misterios: [
      { titulo: "Batismo de Jesus", referencia: "Mt 3,13-17" },
      { titulo: "Bodas de Caná", referencia: "Jo 2,1-12" },
      { titulo: "Anúncio do Reino de Deus", referencia: "Mc 1,14-15" },
      { titulo: "Transfiguração", referencia: "Lc 9,28-36" },
      { titulo: "Instituição da Eucaristia", referencia: "Lc 22,14-20" },
    ],
  },
]

export const partesMissa = [
  { etapa: "Ritos Iniciais", itens: ["Procissão de entrada", "Saudação", "Ato penitencial", "Glória quando previsto", "Oração coleta"] },
  { etapa: "Liturgia da Palavra", itens: ["Primeira leitura", "Salmo responsorial", "Segunda leitura quando prevista", "Aclamação", "Evangelho", "Homilia", "Profissão de fé quando prevista", "Oração dos fiéis"] },
  { etapa: "Liturgia Eucarística", itens: ["Preparação dos dons", "Oração sobre as oferendas", "Oração Eucarística", "Doxologia"] },
  { etapa: "Rito da Comunhão", itens: ["Pai-Nosso", "Rito da paz", "Fração do pão", "Comunhão", "Oração depois da comunhão"] },
  { etapa: "Ritos Finais", itens: ["Avisos quando oportunos", "Bênção", "Despedida", "Procissão de saída"] },
]

export type ModuloLiturgico = {
  id: string
  titulo: string
  descricao: string
  itens: string[]
  referencia?: string
}

export const modulosLiturgicos: ModuloLiturgico[] = [
  {
    id: "liturgia-horas",
    titulo: "Liturgia das Horas completa",
    descricao: "Estrutura para toda a oração oficial ao longo do dia.",
    itens: [
      "Invitatório",
      "Ofício das Leituras — ciclo anual",
      "Ofício das Leituras — ciclo bienal",
      "Laudes",
      "Hora Terça",
      "Hora Sexta",
      "Hora Nona",
      "Vésperas",
      "Completas",
      "Salmodia complementar",
      "Comuns, solenidades, festas e memórias",
      "Coletas salmódicas",
    ],
    referencia: "Mapeado a partir da organização funcional do iLiturgia.",
  },
  {
    id: "lecionario",
    titulo: "Lecionário e Lectio Divina",
    descricao: "Área para a Palavra de Deus do dia e consulta por celebração.",
    itens: [
      "Primeira leitura",
      "Salmo responsorial",
      "Segunda leitura quando prevista",
      "Aclamação ao Evangelho",
      "Evangelho",
      "Evangelho do dia para Lectio Divina",
      "Consulta de Evangelhos",
      "Lecionário dominical, ferial e dos santos",
    ],
    referencia: "O APK de referência possui centenas de documentos de lecionário e Evangelhos.",
  },
  {
    id: "missal",
    titulo: "Missal e ritos",
    descricao: "Organização da celebração e textos próprios por rito e ocasião.",
    itens: [
      "Formulários da Missa",
      "Ordinário da Missa",
      "Prefácios",
      "Orações Eucarísticas",
      "Ritos e celebrações",
      "Próprio do tempo",
      "Próprio dos santos",
      "Comuns",
    ],
    referencia: "Estrutura funcional inspirada no módulo de Missal do iLiturgia.",
  },
  {
    id: "oracoes",
    titulo: "Orações e espiritualidade",
    descricao: "Recursos devocionais para oração pessoal e comunitária.",
    itens: [
      "Santo Rosário",
      "Angelus e Regina Caeli",
      "Via-Sacra",
      "Preparação para a Confissão",
      "Orações tradicionais",
      "Orações para diferentes momentos do dia",
    ],
  },
  {
    id: "formacao",
    titulo: "Formação e aprofundamento",
    descricao: "Conteúdo de apoio para compreender e rezar melhor a liturgia.",
    itens: [
      "Catequeses sobre Salmos e Cânticos",
      "Comentários litúrgicos",
      "Introdução Geral à Liturgia das Horas",
      "Como rezar a Liturgia das Horas",
      "Cânticos em português",
      "Cânticos em latim",
      "Materiais de formação litúrgica",
    ],
    referencia: "O APK de referência contém dezenas de catequeses e comentários.",
  },
  {
    id: "santos",
    titulo: "Santos e calendário",
    descricao: "Memórias, festas, solenidades e santos organizados conforme o calendário litúrgico.",
    itens: [
      "Santo do dia",
      "Próprio dos santos",
      "Memórias obrigatórias e facultativas",
      "Festas e solenidades",
      "Comuns dos santos",
      "Calendário litúrgico",
    ],
    referencia: "O APK de referência possui uma coleção ampla de documentos de santos.",
  },
]

export const fontesLiturgicas = [
  {
    nome: "Edições CNBB — Igreja em Oração",
    descricao: "Fonte oficial escolhida para a Liturgia Diária no Santa Luzia.",
    url: "https://liturgiadiaria.edicoescnbb.com.br/",
  },
  {
    nome: "CNBB — Liturgia das Horas",
    descricao: "Referência institucional para a organização e oração da Liturgia das Horas.",
    url: "https://www.cnbb.org.br/",
  },
]

export const recursosCentro = [
  { id: "liturgia", titulo: "Liturgia Diária", descricao: "Leituras, Evangelho, cor litúrgica e celebração do dia pela fonte oficial definida no aplicativo." },
  { id: "horas", titulo: "Liturgia das Horas", descricao: "Invitatório, Ofício das Leituras, Laudes, Horas Médias, Vésperas e Completas." },
  { id: "biblioteca", titulo: "Biblioteca Litúrgica", descricao: "Lecionário, Missal, santos, orações, catequeses, comentários e demais módulos mapeados do aplicativo de referência." },
  { id: "rosario", titulo: "Santo Rosário", descricao: "Mistérios do dia, referências bíblicas e acompanhamento dezena a dezena." },
  { id: "missa", titulo: "Guia da Santa Missa", descricao: "Estrutura celebrativa para preparação de acólitos, coroinhas e fiéis." },
  { id: "calendario", titulo: "Calendário Litúrgico", descricao: "Tempos, cores e indicação do período litúrgico atual." },
  { id: "leitura", titulo: "Modo de Leitura", descricao: "Ajuste de tamanho da letra, contraste e conforto visual." },
]
