const fs = require("node:fs")
const path = require("node:path")

const ANO = Number(process.env.LITURGIA_ANO || 2026)
const DIRETORIO = path.join(process.cwd(), "public", "offline", "liturgia-completa")
let total = 0

function falhar(mensagem) {
  console.error(`[Auditoria da liturgia completa] ${mensagem}`)
  process.exit(1)
}

for (let mes = 1; mes <= 12; mes += 1) {
  const nome = `${ANO}-${String(mes).padStart(2, "0")}.json`
  const arquivo = path.join(DIRETORIO, nome)
  if (!fs.existsSync(arquivo)) falhar(`Arquivo ausente: ${nome}`)
  const pacote = JSON.parse(fs.readFileSync(arquivo, "utf8"))
  const dias = Object.entries(pacote?.dias || {})
  const esperado = new Date(Date.UTC(ANO, mes, 0)).getUTCDate()
  if (dias.length !== esperado || pacote.total !== esperado) falhar(`${nome}: ${dias.length}/${esperado} dias`)
  for (const [dataIso, dia] of dias) {
    if (!dia?.liturgia || !dia?.cor) falhar(`${dataIso}: cabeçalho incompleto`)
    for (const grupo of ["primeiraLeitura", "salmo", "evangelho"]) {
      const itens = dia?.leituras?.[grupo]
      if (!Array.isArray(itens) || !itens.length) falhar(`${dataIso}: ${grupo} ausente`)
      if (!itens.some((item) => item?.texto)) falhar(`${dataIso}: ${grupo} sem texto`)
    }
  }
  total += dias.length
}

const esperadoAno = new Date(Date.UTC(ANO, 1, 29)).getUTCDate() === 29 ? 366 : 365
if (total !== esperadoAno) falhar(`Cobertura anual incompleta: ${total}/${esperadoAno}`)
console.log(`[Auditoria da liturgia completa] ${ANO} aprovado: ${total} dias com leituras, salmo e Evangelho.`)
