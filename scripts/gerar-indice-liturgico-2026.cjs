const fs = require("node:fs")
const path = require("node:path")

const ANO = Number(process.env.LITURGIA_ANO || 2026)
const DESTINO = path.join(process.cwd(), "public", "offline", "iliturgia", `indice-liturgico-${ANO}.json`)
const BASE = "https://liturgia.up.railway.app/v2/"
const CONCORRENCIA = 10

function pad(n) { return String(n).padStart(2, "0") }
function diasDoAno(ano) {
  const out = []
  for (let m = 0; m < 12; m++) {
    const limite = new Date(Date.UTC(ano, m + 1, 0)).getUTCDate()
    for (let d = 1; d <= limite; d++) out.push(`${ano}-${pad(m + 1)}-${pad(d)}`)
  }
  return out
}
function refs(lista) {
  return Array.isArray(lista) ? lista.map(x => String(x?.referencia || "").trim()).filter(Boolean) : []
}
function simplificar(iso, dados) {
  const leituras = dados?.leituras || {}
  return {
    data: iso,
    liturgia: String(dados?.liturgia || "").trim(),
    cor: String(dados?.cor || "Verde").trim(),
    primeiraLeitura: refs(leituras.primeiraLeitura),
    salmo: refs(leituras.salmo),
    segundaLeitura: refs(leituras.segundaLeitura),
    evangelho: refs(leituras.evangelho),
    extras: refs(leituras.extras),
  }
}
async function buscar(iso, tentativa = 1) {
  const [ano, mes, dia] = iso.split("-")
  const url = `${BASE}?dia=${dia}&mes=${mes}&ano=${ano}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const r = await fetch(url, { headers: { "User-Agent": "ComunidadeSantaLuzia/1.0 indice-offline" }, signal: controller.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    const item = simplificar(iso, j)
    if (!item.liturgia || (!item.primeiraLeitura.length && !item.evangelho.length && !item.extras.length)) throw new Error("Liturgia sem referências")
    return item
  } catch (e) {
    if (tentativa < 3) {
      await new Promise(r => setTimeout(r, 500 * tentativa))
      return buscar(iso, tentativa + 1)
    }
    throw new Error(`${iso}: ${e?.message || e}`)
  } finally {
    clearTimeout(timer)
  }
}
async function mapaConcorrente(datas) {
  const saida = {}
  const erros = []
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= datas.length) return
      const iso = datas[i]
      try { saida[iso] = await buscar(iso) }
      catch (e) { erros.push(String(e?.message || e)) }
    }
  }
  await Promise.all(Array.from({ length: CONCORRENCIA }, () => worker()))
  return { saida, erros }
}
function auditar(saida, total) {
  if (Object.keys(saida).length !== total) throw new Error(`Cobertura anual incompleta: ${Object.keys(saida).length}/${total}`)
  for (const [data, d] of Object.entries(saida)) {
    const refsDia = [...(d.primeiraLeitura || []), ...(d.salmo || []), ...(d.segundaLeitura || []), ...(d.evangelho || []), ...(d.extras || [])]
    if (!d.liturgia || !d.cor || !refsDia.length) throw new Error(`${data}: registro litúrgico incompleto`)
  }
  if (ANO !== 2026) return
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
    const titulo = String(saida[data]?.liturgia || "")
    if (!padrao.test(titulo)) throw new Error(`${data}: celebração inesperada: ${titulo}`)
  }
  console.log(`[Liturgia offline] Auditoria aprovada: ${Object.keys(marcos).length} marcos críticos válidos.`)
}
async function main() {
  const datas = diasDoAno(ANO)
  console.log(`[Liturgia offline] Gerando índice brasileiro de ${ANO} (${datas.length} dias)...`)
  const { saida, erros } = await mapaConcorrente(datas)
  if (erros.length) {
    console.error(erros.slice(0, 20).join("\n"))
    throw new Error(`Índice anual incompleto: ${Object.keys(saida).length}/${datas.length} dias`)
  }
  auditar(saida, datas.length)
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true })
  const payload = {
    versao: 1,
    ano: ANO,
    total: datas.length,
    geradoEm: new Date().toISOString(),
    fonteIndice: "Liturgia Diária v2 (referências e calendário); textos exibidos pelo acervo offline iLiturgia",
    dias: saida,
  }
  fs.writeFileSync(DESTINO, JSON.stringify(payload))
  console.log(`[Liturgia offline] Índice ${ANO} pronto: ${DESTINO}`)
}
main().catch(e => { console.error(e); process.exit(1) })
