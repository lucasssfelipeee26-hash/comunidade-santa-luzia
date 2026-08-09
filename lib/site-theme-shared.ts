export const temasSantaLuzia = [
  {
    id: "manto-rubi",
    nome: "Manto Rubi + Dourado",
    descricao: "Vermelho rubi inspirado no manto de Santa Luzia, com detalhes dourados e fundo creme.",
    cores: ["#7b1326", "#5a0b18", "#d4af37", "#fff8ee"],
  },
  {
    id: "bordo-ouro",
    nome: "Bordô + Ouro",
    descricao: "Uma combinação mais sóbria, com bordô profundo, ouro antigo e marfim.",
    cores: ["#5d1020", "#3b0710", "#c99a2e", "#fbf4e8"],
  },
  {
    id: "marfim-rubi",
    nome: "Marfim + Rubi",
    descricao: "Tema mais claro, com bastante marfim, rubi nos destaques e dourado suave.",
    cores: ["#8a2035", "#fffaf2", "#d8b45a", "#ffffff"],
  },
  {
    id: "vinho-dourado",
    nome: "Vinho Escuro + Dourado",
    descricao: "Tema solene para o site público, com vinho escuro, dourado luminoso e creme.",
    cores: ["#490b17", "#2f060d", "#dfbb55", "#f8efe3"],
  },
] as const

export type TemaSite = (typeof temasSantaLuzia)[number]["id"]

export const TEMA_PADRAO: TemaSite = "manto-rubi"

export function temaValido(valor: unknown): valor is TemaSite {
  return temasSantaLuzia.some((tema) => tema.id === valor)
}
