import { celebracaoDoDia, imagemCelebracao, type CelebracaoLiturgica } from "@/lib/iliturgia-sanctoral"

export { imagemCelebracao }

function isoLocal(data: Date) {
  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, "0")
  const d = String(data.getDate()).padStart(2, "0")
  return `${a}-${m}-${d}`
}

// Ajustes do Calendário Próprio do Brasil para 2026.
// O índice anual continua sendo a autoridade para título/cor/leituras;
// estes ajustes garantem que Santo do Dia, Ofício e Próprio usem a data brasileira correta.
const brasil2026: Record<string, CelebracaoLiturgica | null> = {
  "2026-06-28": { nome: "São Pedro e São Paulo, Apóstolos", chave: "pedroepaulo", grau: "solenidade" },
  "2026-06-29": null,
  "2026-07-17": { nome: "Bem-aventurado Inácio de Azevedo e companheiros mártires", chave: "inaciodeazevedo", grau: "memoria" },
  "2026-07-20": null,
  "2026-08-12": { nome: "São Ponciano e Santo Hipólito", chave: "saoponciano", grau: "memoria-facultativa" },
  "2026-08-13": { nome: "Santa Dulce Lopes Pontes", chave: "", grau: "memoria" },
  "2026-08-15": null,
  "2026-08-16": { nome: "Assunção de Nossa Senhora", chave: "assuncao", grau: "solenidade" },
}

export function celebracaoDoDiaBrasil(data: Date = new Date()): CelebracaoLiturgica | null {
  const iso = isoLocal(data)
  if (Object.prototype.hasOwnProperty.call(brasil2026, iso)) return brasil2026[iso]
  return celebracaoDoDia(data)
}
