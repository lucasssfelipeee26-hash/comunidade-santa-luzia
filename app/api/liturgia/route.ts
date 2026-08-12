import { NextResponse } from "next/server"
import { tempoLiturgico } from "@/lib/calendario"

export const revalidate = 1800

const LITURGIA_URL =
  process.env.LITURGIA_SOURCE_URL || "https://liturgiadiaria.edicoescnbb.com.br/"
const CACHE_MS = 30 * 60 * 1000

type LiturgiaCache = {
  dataIso: string
  expiraEm: number
  payload: Liturgia
}

let cacheLiturgia: LiturgiaCache | null = null

type Leitura = {
  referencia?: string
  titulo?: string
  texto?: string
  refrao?: string
}

export type SantoDoDia = {
  nome: string
  resumo?: string
  fonte: string
}

export type Liturgia = {
  data: string
  liturgia: string
  liturgiaOriginal?: string
  cor: string
  tempoLiturgicoAtual: string
  tempoCategoria: string
  santoDoDia?: SantoDoDia | null
  fonte: {
    nome: string
    url: string
  }
  oracoes: {
    coleta?: string
    oferendas?: string
    comunhao?: string
  }
  leituras: {
    primeiraLeitura?: Leitura[]
    salmo?: Leitura[]
    segundaLeitura?: Leitura[]
    evangelho?: Leitura[]
  }
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
    aacute: "á",
    eacute: "é",
    iacute: "í",
    oacute: "ó",
    uacute: "ú",
    Aacute: "Á",
    Eacute: "É",
    Iacute: "Í",
    Oacute: "Ó",
    Uacute: "Ú",
    ccedil: "ç",
    Ccedil: "Ç",
  }

  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, key) => entities[key] ?? entities[key.toLowerCase()] ?? m)
}

function htmlToLines(html: string) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<img\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|tr|blockquote|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")

  return decodeHtml(text)
    .split(/\r?\n/)
    .map((line) => line.normalize("NFC").replace(/\u00ad/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^Image$/i.test(line))
}

function toRoman(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 40) return String(value)
  const table: Array<[number, string]> = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ]
  let n = value
  let out = ""
  for (const [decimal, roman] of table) {
    while (n >= decimal) {
      out += roman
      n -= decimal
    }
  }
  return out
}

function romanizarOrdinalLiturgico(texto: string) {
  return texto.replace(/\b(\d{1,2})\s*(?:º|ª|°|o|a)(?=\s|$)/gi, (_, n) => toRoman(Number(n)))
}

function deriveTempoLiturgico(celebracao: string, semana?: string) {
  const raw = `${celebracao} ${semana || ""}`.trim()
  const ordinal = raw.match(/\b(\d{1,2})\s*(?:º|ª|°|o|a)?\s*Semana/i)
  const romano = ordinal ? toRoman(Number(ordinal[1])) : null

  if (/Tempo Comum/i.test(raw)) return romano ? `${romano} Semana do Tempo Comum` : "Tempo Comum"
  if (/Advento/i.test(raw)) return romano ? `${romano} Semana do Advento` : "Advento"
  if (/Quaresma/i.test(raw)) return romano ? `${romano} Semana da Quaresma` : "Quaresma"
  if (/Páscoa|Pascal/i.test(raw)) return romano ? `${romano} Semana da Páscoa` : "Tempo Pascal"
  if (/Natal|Epifania|Batismo do Senhor/i.test(raw)) return "Tempo do Natal"
  if (/Tríduo|Ceia do Senhor|Paixão do Senhor|Vigília Pascal/i.test(raw)) return "Tríduo Pascal"
  return romanizarOrdinalLiturgico(semana || celebracao || "Liturgia do Dia")
}

function categoriaLiturgica(celebracao: string, semana: string | undefined, dataIso: string) {
  const raw = `${celebracao} ${semana || ""}`
  if (/Advento/i.test(raw)) return "Advento"
  if (/Natal|Epifania|Batismo do Senhor/i.test(raw)) return "Natal"
  if (/Quaresma/i.test(raw)) return "Quaresma"
  if (/Páscoa|Pentecostes|Tríduo|Ceia do Senhor|Paixão do Senhor/i.test(raw)) return "Tríduo Pascal e Páscoa"
  if (/Tempo Comum/i.test(raw)) {
    const [ano, mes, dia] = dataIso.split("-").map(Number)
    const localDate = new Date(ano, mes - 1, dia, 12, 0, 0)
    const calculado = tempoLiturgico(localDate).chave
    return calculado === "Tempo Comum (I)" ? "Tempo Comum (I)" : "Tempo Comum (II)"
  }
  return tempoLiturgico().chave
}

function corPorCelebracao(celebracao: string, semana?: string) {
  const raw = `${celebracao} ${semana || ""}`
  if (/Pentecostes|Paixão|Apóstol|Evangelista|Mártir/i.test(raw)) return "Vermelho"
  if (/Advento|Quaresma/i.test(raw)) return "Roxo"
  if (/Natal|Páscoa|Epifania|Batismo do Senhor|Solenidade|Festa|Nossa Senhora|Maria|José|Anjo/i.test(raw)) return "Branco"
  return "Verde"
}

function findIndex(lines: string[], regex: RegExp, from = 0) {
  for (let i = from; i < lines.length; i += 1) if (regex.test(lines[i])) return i
  return -1
}

function section(lines: string[], startRegex: RegExp, stopRegexes: RegExp[]) {
  const start = findIndex(lines, startRegex)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (stopRegexes.some((regex) => regex.test(lines[i]))) {
      end = i
      break
    }
  }
  return { start, heading: lines[start], body: lines.slice(start + 1, end) }
}

function cleanBody(body: string[]) {
  return body
    .filter((line) => !/^Conferência Nacional dos Bispos do Brasil$/i.test(line))
    .filter((line) => !/^©\s*Todos os direitos reservados/i.test(line))
    .filter((line) => !/^[A-ZÁÉÍÓÚÇ][a-záéíóúç]+\s+20\d{2}$/.test(line))
    .filter((line) => !/^R\.?\s*Aleluia/i.test(line))
}

function referenceFromHeading(heading: string) {
  return heading.split(/\s+-\s+/).slice(1).join(" - ").trim() || undefined
}

function leitura(sectionValue: ReturnType<typeof section>, type: "leitura" | "salmo" | "evangelho"): Leitura[] | undefined {
  if (!sectionValue) return undefined
  let body = cleanBody(sectionValue.body)
  if (!body.length) return undefined

  let referencia = referenceFromHeading(sectionValue.heading)
  if (!referencia) {
    const refLine = body.find((line) => /\b\d{1,3}(?:,|\s)\d/.test(line) && line.length < 90)
    if (refLine && !/Leitura da|Proclamação do/i.test(refLine)) referencia = refLine
  }

  if (type === "salmo") {
    const refraoLine = body.find((line) => /^R\./i.test(line))
    const refrao = refraoLine?.replace(/^R\.\s*/i, "").trim()
    body = body.filter((line) => line !== refraoLine)
    return [{ referencia, refrao, texto: body.join("\n") }]
  }

  if (type === "evangelho") {
    const proclamation = body.findIndex((line) => /^Proclamação do Evangelho/i.test(line))
    if (proclamation >= 0) {
      const match = body[proclamation].match(/segundo\s+.+?\s+([A-Z][a-z]?\s*\d.+)$/i)
      if (match) referencia = match[1].trim()
    }
  }

  const titulo = body[0] && body[0].length < 180 && !/^Leitura da|^Proclamação/i.test(body[0]) ? body.shift() : undefined
  return [{ referencia, titulo, texto: body.join("\n") }]
}

function dataCuiabaIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function formatarData(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12)))
}

function extractLiturgiaCNBB(html: string, dataIso: string): Liturgia {
  const lines = htmlToLines(html)

  const dataLineIndex = findIndex(lines, /(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)-feira,?\s+\d{1,2}\s+de\s+.+\s+de\s+20\d{2}/i)
  const afterDate = dataLineIndex >= 0 ? lines.slice(dataLineIndex + 1, dataLineIndex + 7) : lines.slice(0, 12)
  const semana = afterDate.find((line) => /Semana do Tempo Comum|Semana do Advento|Semana da Quaresma|Semana da Páscoa|Oitava da Páscoa/i.test(line))
  const celebracao = afterDate.find((line) =>
    line !== semana &&
    !/^Leituras/i.test(line) &&
    !/^(A-|A\+|Liturgia Diária)$/i.test(line) &&
    line.length > 3 && line.length < 140,
  ) || semana || "Liturgia do Dia"

  const primeira = section(lines, /^PRIMEIRA LEITURA(?:\s+-.*)?$/i, [
    /^Salmo responsorial/i,
    /^SEGUNDA LEITURA/i,
    /^Evangelho\s+-/i,
    /^ACLAMAÇÃO AO EVANGELHO/i,
  ])
  const salmo = section(lines, /^Salmo responsorial(?:\s+-.*)?$/i, [
    /^SEGUNDA LEITURA/i,
    /^Evangelho\s+-/i,
    /^ACLAMAÇÃO AO EVANGELHO/i,
  ])
  const segunda = section(lines, /^SEGUNDA LEITURA(?:\s+-.*)?$/i, [
    /^Evangelho\s+-/i,
    /^ACLAMAÇÃO AO EVANGELHO/i,
  ])

  let evangelhoStart = findIndex(lines, /^EVANGELHO$/i)
  if (evangelhoStart < 0) evangelhoStart = findIndex(lines, /^Evangelho\s+-/i)
  let evangelho: ReturnType<typeof section> = null
  if (evangelhoStart >= 0) {
    let end = lines.length
    for (let i = evangelhoStart + 1; i < lines.length; i += 1) {
      if (/^Conferência Nacional dos Bispos do Brasil$/i.test(lines[i])) {
        end = i
        break
      }
    }
    const heading = lines[evangelhoStart]
    const referenceHeading = [...lines.slice(Math.max(0, evangelhoStart - 8), evangelhoStart + 1)]
      .reverse()
      .find((line) => /^Evangelho\s+-/i.test(line))
    evangelho = {
      start: evangelhoStart,
      heading: referenceHeading || heading,
      body: lines.slice(evangelhoStart + 1, end),
    }
  }

  const leituras = {
    primeiraLeitura: leitura(primeira, "leitura"),
    salmo: leitura(salmo, "salmo"),
    segundaLeitura: leitura(segunda, "leitura"),
    evangelho: leitura(evangelho, "evangelho"),
  }

  const santoDoDia = /Memória|Festa|Solenidade/i.test(celebracao)
    ? { nome: celebracao.replace(/,\s*(Memória|Festa|Solenidade).*$/i, "").trim(), fonte: LITURGIA_URL }
    : null

  return {
    data: dataLineIndex >= 0 ? lines[dataLineIndex] : formatarData(dataIso),
    liturgia: romanizarOrdinalLiturgico(celebracao),
    liturgiaOriginal: celebracao,
    cor: corPorCelebracao(celebracao, semana),
    tempoLiturgicoAtual: deriveTempoLiturgico(celebracao, semana),
    tempoCategoria: categoriaLiturgica(celebracao, semana, dataIso),
    santoDoDia,
    fonte: { nome: "Edições CNBB — Igreja em Oração", url: LITURGIA_URL },
    oracoes: {},
    leituras,
  }
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 1800 },
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "User-Agent": "Mozilla/5.0 (compatible; ComunidadeSantaLuzia/2.0; liturgia oficial CNBB)",
    },
  })
  if (!response.ok) throw new Error(`Fonte oficial respondeu com HTTP ${response.status}`)
  return response.text()
}

export async function GET() {
  const dataIso = dataCuiabaIso()
  const agora = Date.now()

  if (cacheLiturgia?.dataIso === dataIso && cacheLiturgia.expiraEm > agora) {
    return NextResponse.json(cacheLiturgia.payload, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=1500",
        "X-Santa-Luzia-Cache": "hit",
      },
    })
  }

  try {
    const html = await fetchHtml(LITURGIA_URL)
    const payload = extractLiturgiaCNBB(html, dataIso)

    if (!payload.leituras.primeiraLeitura || !payload.leituras.evangelho) {
      throw new Error("A estrutura da página oficial da CNBB não pôde ser reconhecida.")
    }

    cacheLiturgia = { dataIso, expiraEm: agora + CACHE_MS, payload }
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=1500",
        "X-Santa-Luzia-Cache": "miss",
      },
    })
  } catch (error) {
    console.error("[Liturgia] Falha ao atualizar pela Edições CNBB:", error)

    if (cacheLiturgia?.dataIso === dataIso) {
      return NextResponse.json(cacheLiturgia.payload, {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=900",
          "X-Santa-Luzia-Cache": "stale",
        },
      })
    }

    return NextResponse.json(
      {
        error: "Não foi possível atualizar a Liturgia Diária pela fonte oficial da Edições CNBB neste momento.",
        fonte: { nome: "Edições CNBB — Igreja em Oração", url: LITURGIA_URL },
      },
      { status: 502 },
    )
  }
}
