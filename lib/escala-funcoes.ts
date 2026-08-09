export const FUNCOES_ESCALA = [
  "1º Cerimoniário",
  "2º Cerimoniário",
  "Cruciferário",
  "1º Ceroferário",
  "2º Ceroferário",
  "1º Mestre de Procissão",
  "2º Mestre de Procissão",
  "Turiferário",
  "Naviculário",
  "Librífero",
  "Auxiliar de Credência",
] as const

export type FuncaoEscala = (typeof FUNCOES_ESCALA)[number]

const FUNCOES_PERMITIDAS = new Set<string>(FUNCOES_ESCALA)

export function funcaoEscalaValida(valor: string): valor is FuncaoEscala {
  return FUNCOES_PERMITIDAS.has(valor)
}

export function ordemFuncaoEscala(funcao: string) {
  const indice = FUNCOES_ESCALA.indexOf(funcao as FuncaoEscala)
  return indice === -1 ? Number.MAX_SAFE_INTEGER : indice
}
