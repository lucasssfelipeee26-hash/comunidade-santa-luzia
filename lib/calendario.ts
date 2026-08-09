// Cálculo do tempo litúrgico atual conforme o calendário litúrgico anual.
// As chaves correspondem aos cartões exibidos em CalendarioLiturgico.

export type TempoChave =
  | "Advento"
  | "Natal"
  | "Tempo Comum (I)"
  | "Quaresma"
  | "Tríduo Pascal e Páscoa"
  | "Tempo Comum (II)"

function diasDepois(base: Date, dias: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d
}

// Algoritmo de Meeus/Jones/Butcher (Páscoa gregoriana).
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

// Primeiro Domingo do Advento: 4º domingo antes do Natal.
function inicioAdvento(ano: number): Date {
  const natal = new Date(ano, 11, 25)
  const dow = natal.getDay() // 0 = domingo
  const domingoAntesDoNatal = diasDepois(natal, dow === 0 ? -7 : -dow)
  return diasDepois(domingoAntesDoNatal, -21)
}

// Batismo do Senhor: domingo em/ou após 7 de janeiro (fim do Tempo do Natal).
function batismoDoSenhor(ano: number): Date {
  const ref = new Date(ano, 0, 7)
  const dow = ref.getDay()
  return dow === 0 ? ref : diasDepois(ref, 7 - dow)
}

function soData(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function tempoLiturgico(hoje: Date = new Date()): { chave: TempoChave; ano: number } {
  const d = soData(hoje)
  const ano = d.getFullYear()

  const pasc = soData(pascoa(ano))
  const quartaCinzas = diasDepois(pasc, -46)
  const quintaSanta = diasDepois(pasc, -3) // início do Tríduo
  const pentecostes = diasDepois(pasc, 49)
  const advento = soData(inicioAdvento(ano))
  const natal = new Date(ano, 11, 25)
  const batismo = soData(batismoDoSenhor(ano))

  if (d >= advento && d < natal) return { chave: "Advento", ano }
  if (d >= natal || d <= batismo) return { chave: "Natal", ano }
  if (d > batismo && d < quartaCinzas) return { chave: "Tempo Comum (I)", ano }
  if (d >= quartaCinzas && d < quintaSanta) return { chave: "Quaresma", ano }
  if (d >= quintaSanta && d <= pentecostes) return { chave: "Tríduo Pascal e Páscoa", ano }
  return { chave: "Tempo Comum (II)", ano }
}
