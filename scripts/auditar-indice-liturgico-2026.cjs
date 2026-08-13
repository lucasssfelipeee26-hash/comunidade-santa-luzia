const fs = require("node:fs")
const path = require("node:path")

const ANO = Number(process.env.LITURGIA_ANO || 2026)
const arquivo = path.join(process.cwd(), "public", "offline", "iliturgia", `indice-liturgico-${ANO}.json`)

function falhar(msg) {
  console.error(`[Auditoria litúrgica] ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(arquivo)) falhar(`Índice anual ausente: ${arquivo}`)

let indice
try { indice = JSON.parse(fs.readFileSync(arquivo, "utf8")) }
catch (e) { falhar(`Índice inválido: ${e?.message || e}`) }

const dias = indice?.dias || {}
const chaves = Object.keys(dias)
const esperado = new Date(Date.UTC(ANO, 1, 29)).getUTCDate() === 29 ? 366 : 365
if (chaves.length !== esperado || Number(indice.total) !== esperado) {
  falhar(`Cobertura anual incompleta: ${chaves.length}/${esperado} dias`)
}

for (const data of chaves) {
  const d = dias[data]
  if (!d?.liturgia) falhar(`${data}: celebração sem título`)
  if (!d?.cor) falhar(`${data}: cor litúrgica ausente`)
  const refs = [
    ...(d.primeiraLeitura || []),
    ...(d.salmo || []),
    ...(d.segundaLeitura || []),
    ...(d.evangelho || []),
    ...(d.extras || []),
  ].filter(Boolean)
  if (!refs.length) falhar(`${data}: nenhuma referência bíblica`)
}

const marcos = {
  "2026-02-18": /cinzas/i,
  "2026-03-29": /ramos|paix[aã]o/i,
  "2026-04-02": /ceia|quinta/i,
  "2026-04-03": /paix[aã]o|sexta/i,
  "2026-04-04": /s[aá]bado|vig[ií]lia/i,
  "2026-04-05": /p[aá]scoa|ressurrei/i,
  "2026-05-24": /pentecostes/i,
  "2026-06-04": /corpo|corpus/i,
  "2026-06-28": /pedro.*paulo|paulo.*pedro/i,
  "2026-08-13": /dulce/i,
  "2026-08-16": /assun[cç][aã]o/i,
  "2026-10-12": /aparecida/i,
  "2026-11-22": /cristo.*rei|rei.*universo/i,
  "2026-12-08": /imaculada/i,
  "2026-12-25": /natal|nascimento do senhor/i,
}

for (const [data, padrao] of Object.entries(marcos)) {
  const titulo = String(dias[data]?.liturgia || "")
  if (!padrao.test(titulo)) falhar(`${data}: celebração inesperada: “${titulo}”`)
}

console.log(`[Auditoria litúrgica] ${ANO} aprovado: ${esperado} dias e ${Object.keys(marcos).length} marcos críticos válidos.`)
