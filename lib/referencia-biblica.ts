export function normalizarReferenciaBiblica(valor?: string | null) {
  let referencia = String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!referencia) return ""

  referencia = referencia
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*[-–—]\s*/g, "–")
    .replace(/\s*:\s*/g, ":")
    .replace(/;\s*/g, "; ")
    .replace(/\s{2,}/g, " ")
    .trim()

  return referencia
}

export function chaveReferenciaBiblica(valor?: string | null) {
  return normalizarReferenciaBiblica(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
}

export function separarNumeroVersiculo(linha: string) {
  const texto = String(linha || "").trim()
  const encontrado = texto.match(/^(\d{1,3}[a-z]?)[.)]?\s+(.+)$/i)
  if (!encontrado) return null
  return { numero: encontrado[1], texto: encontrado[2].trim() }
}
