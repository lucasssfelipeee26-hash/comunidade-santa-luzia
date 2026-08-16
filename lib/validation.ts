export function dataCivilIsoValida(valor: string, opcoes: { anoMinimo?: number; anoMaximo?: number } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [ano, mes, dia] = valor.split("-").map(Number)
  const anoMinimo = opcoes.anoMinimo ?? 1900
  const anoMaximo = opcoes.anoMaximo ?? 2100
  if (!Number.isInteger(ano) || ano < anoMinimo || ano > anoMaximo) return false
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

export function horario24hValido(valor: string, permitirVazio = false) {
  if (permitirVazio && valor === "") return true
  const match = /^(\d{2}):(\d{2})$/.exec(valor)
  if (!match) return false
  const hora = Number(match[1])
  const minuto = Number(match[2])
  return Number.isInteger(hora) && Number.isInteger(minuto) && hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59
}

export function anoOperacionalValido(valor: number) {
  return Number.isInteger(valor) && valor >= 2020 && valor <= 2100
}
