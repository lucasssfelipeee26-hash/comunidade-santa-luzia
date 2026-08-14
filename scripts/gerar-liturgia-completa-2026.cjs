const fs = require("node:fs")
const path = require("node:path")

const ANO = Number(process.env.LITURGIA_ANO || 2026)
const DESTINO = path.join(process.cwd(), "public", "offline", "liturgia-completa")
const BASE = "https://liturgia.up.railway.app/v2/"
const CONCORRENCIA = 8

function pad(numero) { return String(numero).padStart(2, "0") }

function datasDoAno(ano) {
  const datas = []
  for (let mes = 1; mes <= 12; mes += 1) {
    const limite = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
    for (let dia = 1; dia <= limite; dia += 1) datas.push(`${ano}-${pad(mes)}-${pad(dia)}`)
  }
  return datas
}

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : ""
}

function leituras(lista) {
  if (!Array.isArray(lista)) return []
  return lista.map((item) => ({
    ...(texto(item?.titulo) ? { titulo: texto(item.titulo) } : {}),
    ...(texto(item?.referencia) ? { referencia: texto(item.referencia) } : {}),
    ...(texto(item?.refrao) ? { refrao: texto(item.refrao) } : {}),
    ...(texto(item?.texto) ? { texto: texto(item.texto) } : {}),
  })).filter((item) => item.referencia || item.texto)
}

function normalizar(dataIso, dados) {
  const grupos = dados?.leituras || {}
  return {
    dataIso,
    data: texto(dados?.data),
    liturgia: texto(dados?.liturgia),
    cor: texto(dados?.cor) || "Verde",
    tempoLiturgicoAtual: texto(dados?.tempoLiturgicoAtual),
    tempoCategoria: texto(dados?.tempoCategoria),
    oracoes: {
      ...(texto(dados?.oracoes?.coleta) ? { coleta: texto(dados.oracoes.coleta) } : {}),
      ...(texto(dados?.oracoes?.oferendas) ? { oferendas: texto(dados.oracoes.oferendas) } : {}),
      ...(texto(dados?.oracoes?.comunhao) ? { comunhao: texto(dados.oracoes.comunhao) } : {}),
    },
    leituras: {
      primeiraLeitura: leituras(grupos.primeiraLeitura),
      salmo: leituras(grupos.salmo),
      segundaLeitura: leituras(grupos.segundaLeitura),
      evangelho: leituras(grupos.evangelho),
      extras: leituras(grupos.extras),
    },
  }
}

async function buscar(dataIso, tentativa = 1) {
  const [ano, mes, dia] = dataIso.split("-")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const resposta = await fetch(`${BASE}?dia=${dia}&mes=${mes}&ano=${ano}`, {
      headers: { "User-Agent": "ComunidadeSantaLuzia/1.0 liturgia-offline" },
      signal: controller.signal,
    })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    const item = normalizar(dataIso, await resposta.json())
    if (!item.liturgia || !item.leituras.primeiraLeitura.length || !item.leituras.evangelho.length) {
      throw new Error("Liturgia completa ausente")
    }
    return item
  } catch (error) {
    if (tentativa < 3) {
      await new Promise((resolve) => setTimeout(resolve, tentativa * 700))
      return buscar(dataIso, tentativa + 1)
    }
    throw new Error(`${dataIso}: ${error?.message || error}`)
  } finally {
    clearTimeout(timer)
  }
}

async function gerar() {
  const datas = datasDoAno(ANO)
  const dias = {}
  const erros = []
  let cursor = 0

  async function worker() {
    while (true) {
      const posicao = cursor++
      if (posicao >= datas.length) return
      const dataIso = datas[posicao]
      try { dias[dataIso] = await buscar(dataIso) }
      catch (error) { erros.push(String(error?.message || error)) }
    }
  }

  console.log(`[Liturgia completa] Baixando ${datas.length} dias de ${ANO}...`)
  await Promise.all(Array.from({ length: CONCORRENCIA }, () => worker()))
  if (erros.length) throw new Error(`Falharam ${erros.length} dias:\n${erros.slice(0, 20).join("\n")}`)

  fs.mkdirSync(DESTINO, { recursive: true })
  for (let mes = 1; mes <= 12; mes += 1) {
    const prefixo = `${ANO}-${pad(mes)}-`
    const diasDoMes = Object.fromEntries(Object.entries(dias).filter(([dataIso]) => dataIso.startsWith(prefixo)))
    const arquivo = path.join(DESTINO, `${ANO}-${pad(mes)}.json`)
    fs.writeFileSync(arquivo, JSON.stringify({ versao: 1, ano: ANO, mes, total: Object.keys(diasDoMes).length, dias: diasDoMes }))
    console.log(`[Liturgia completa] ${path.basename(arquivo)}: ${Object.keys(diasDoMes).length} dias`)
  }
}

gerar().catch((error) => { console.error(error); process.exit(1) })
