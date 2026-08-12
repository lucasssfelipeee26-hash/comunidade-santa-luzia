export type CicloDominical = "A" | "B" | "C"
export type CicloFerial = "I" | "II"

function soData(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

function diasDepois(base: Date, dias: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d
}

// Primeiro Domingo do Advento: domingo entre 27/11 e 03/12.
function inicioAdvento(ano: number) {
  const referencia = new Date(ano, 10, 27)
  const deslocamento = (7 - referencia.getDay()) % 7
  return diasDepois(referencia, deslocamento)
}

export function anoLiturgicoDaData(data: Date = new Date()) {
  const d = soData(data)
  const anoCivil = d.getFullYear()
  return d >= soData(inicioAdvento(anoCivil)) ? anoCivil + 1 : anoCivil
}

export function cicloDominicalDaData(data: Date = new Date()): CicloDominical {
  const ano = anoLiturgicoDaData(data)
  const resto = ((ano % 3) + 3) % 3
  if (resto === 1) return "A"
  if (resto === 2) return "B"
  return "C"
}

export function cicloFerialDaData(data: Date = new Date()): CicloFerial {
  return anoLiturgicoDaData(data) % 2 === 0 ? "II" : "I"
}

export function ciclosLiturgicos(data: Date = new Date()) {
  return {
    anoLiturgico: anoLiturgicoDaData(data),
    cicloDominical: cicloDominicalDaData(data),
    cicloFerial: cicloFerialDaData(data),
  }
}

export function dataIsoParaDate(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  if (!ano || !mes || !dia) return new Date()
  return new Date(ano, mes - 1, dia, 12, 0, 0)
}
