import { NextResponse } from "next/server"
import { tempoLiturgico } from "@/lib/calendario"

export const revalidate = 1800
const LITURGIA_URL = process.env.LITURGIA_SOURCE_URL || "https://liturgia.cancaonova.com/pb/"
const SANTO_URL = process.env.SANTO_SOURCE_URL || "https://santo.cancaonova.com/"
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
  }

  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, key) => entities[key.toLowerCase()] ?? m)
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function htmlToLines(html: string) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")

  return decodeHtml(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function limparTextoLiturgico(value: string) {
  return value
    .normalize("NFC")
    .replace(/\u00ad/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([«“"])\s+/g, "$1")
    .replace(/\s+([»”"])/g, "$1")
    .trim()
}

function headings(html: string) {
  return [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
}

function toRoman(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 40) return String(value)
  const table: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
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
  return texto
    .normalize("NFC")
    .replace(/\b(\d{1,2})\s*(?:º|ª|°|o|a)(?=\s|$)/gi, (_, n) => toRoman(Number(n)))
}

function deriveTempoLiturgico(celebracao: string) {
  const raw = celebracao.trim()
  const ordinal = raw.match(/\b(\d{1,2})\s*(?:º|ª|°|o|a)(?=\s|$)/i)
  const romano = ordinal ? toRoman(Number(ordinal[1])) : null

  if (/Tempo Comum/i.test(raw)) {
    return romano ? `${romano} Semana do Tempo Comum` : "Tempo Comum"
  }
  if (/Advento/i.test(raw)) {
    return romano ? `${romano} Semana do Advento` : "Advento"
  }
  if (/Quaresma/i.test(raw)) {
    return romano ? `${romano} Semana da Quaresma` : "Quaresma"
  }
  if (/Páscoa/i.test(raw)) {
    return romano ? `${romano} Semana da Páscoa` : "Tempo Pascal"
  }
  if (/Natal/i.test(raw)) return "Tempo do Natal"
  if (/Tríduo|Ceia do Senhor|Paixão do Senhor|Vigília Pascal/i.test(raw)) return "Tríduo Pascal"

  return romanizarOrdinalLiturgico(raw)
}

function categoriaLiturgica(celebracao: string, dataIso: string) {
  if (/Advento/i.test(celebracao)) return "Advento"
  if (/Natal|Epifania|Batismo do Senhor/i.test(celebracao)) return "Natal"
  if (/Quaresma/i.test(celebracao)) return "Quaresma"
  if (/Páscoa|Pentecostes|Tríduo|Ceia do Senhor|Paixão do Senhor/i.test(celebracao)) {
    return "Tríduo Pascal e Páscoa"
  }
  if (/Tempo Comum/i.test(celebracao)) {
    const [ano, mes, dia] = dataIso.split("-").map(Number)
    const localDate = new Date(ano, mes - 1, dia, 12, 0, 0)
    const calculado = tempoLiturgico(localDate).chave
    return calculado === "Tempo Comum (I)" ? "Tempo Comum (I)" : "Tempo Comum (II)"
  }
  return tempoLiturgico().chave
}

function referenciaDoTitulo(titulo: string) {
  const parenteses = titulo.match(/\(([^)]+)\)/)
  if (parenteses) return parenteses[1].trim()
  return titulo.replace(/^(Responsório|Salmo Responsorial)\s*/i, "").trim() || undefined
}

function sliceSection(lines: string[], starts: RegExp, stops: RegExp[]) {
  const start = lines.findIndex((line) => starts.test(line))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (stops.some((stop) => stop.test(lines[i]))) {
      end = i
      break
    }
  }
  return { heading: lines[start], body: lines.slice(start + 1, end) }
}

function leituraFromSection(
  section: ReturnType<typeof sliceSection>,
  salmo = false,
  evangelho = false,
): Leitura[] | undefined {
  if (!section) return undefined

  let body = section.body
    .map(limparTextoLiturgico)
    .filter((line) => !/^A\+|^A-|^Compartilhar$/i.test(line))
    .filter((line) => !/^iframe$/i.test(line))
    .filter((line) => line.length > 1)

  if (evangelho) {
    const palavra = body.findIndex((line) => /Palavra da Salvação/i.test(line))
    if (palavra >= 0) {
      const gloria = body.findIndex((line, index) => index > palavra && /Glória a vós, Senhor/i.test(line))
      body = body.slice(0, gloria >= 0 ? gloria + 1 : palavra + 1)
    }
  }

  if (!body.length) return undefined

  if (salmo) {
    const primeira = body.find((line) => /^[-–—]/.test(line))
    const refrao = primeira?.replace(/^[-–—]\s*/, "").trim()
    const texto = body
      .filter((line, index) => !(index > 0 && refrao && line.replace(/^[-–—]\s*/, "").trim() === refrao))
      .join("\n")
    return [{ referencia: referenciaDoTitulo(section.heading), refrao, texto }]
  }

  return [{ referencia: referenciaDoTitulo(section.heading), texto: body.join("\n") }]
}

function extractLiturgia(html: string, dataIso: string): Omit<Liturgia, "santoDoDia"> {
  const lines = htmlToLines(html)
  const hs = headings(html)
  const cor = lines.find((line) => /^Cor Litúrgica:/i.test(line))?.replace(/^Cor Litúrgica:\s*/i, "").trim() || ""
  const celebracaoOriginal =
    hs.find((h) => /Tempo Comum|Advento|Quaresma|Páscoa|Natal|Solenidade|Festa|Memória|Domingo|Semana/i.test(h)) ||
    lines.find((line) => /Tempo Comum|Advento|Quaresma|Páscoa|Natal|Solenidade|Festa|Memória|Domingo|Semana/i.test(line)) ||
    "Liturgia do Dia"

  const primeira = sliceSection(lines, /^Primeira Leitura\s*\(/i, [
    /^Responsório\b/i,
    /^Salmo Responsorial\b/i,
    /^Segunda Leitura\s*\(/i,
    /^Evangelho\s*\(/i,
  ])
  const salmo = sliceSection(lines, /^(Responsório|Salmo Responsorial)\b/i, [
    /^Segunda Leitura\s*\(/i,
    /^Evangelho\s*\(/i,
  ])
  const segunda = sliceSection(lines, /^Segunda Leitura\s*\(/i, [/^Evangelho\s*\(/i])
  const evangelho = sliceSection(lines, /^Evangelho\s*\(/i, [
    /^Conferência Nacional dos Bispos do Brasil/i,
    /^Ajude a Canção Nova/i,
  ])

  const [ano, mes, dia] = dataIso.split("-").map(Number)
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)))

  return {
    data,
    liturgia: romanizarOrdinalLiturgico(celebracaoOriginal),
    liturgiaOriginal: celebracaoOriginal,
    cor,
    tempoLiturgicoAtual: deriveTempoLiturgico(celebracaoOriginal),
    tempoCategoria: categoriaLiturgica(celebracaoOriginal, dataIso),
    fonte: { nome: "Canção Nova", url: LITURGIA_URL },
    oracoes: {},
    leituras: {
      primeiraLeitura: leituraFromSection(primeira),
      salmo: leituraFromSection(salmo, true),
      segundaLeitura: leituraFromSection(segunda),
      evangelho: leituraFromSection(evangelho, false, true),
    },
  }
}

function extractSanto(html: string): SantoDoDia | null {
  const hs = headings(html)
  const nome = hs.find((h) => !/^Santo do Dia$/i.test(h) && !/^Todos os Santos$/i.test(h))
  if (!nome) return null

  const lines = htmlToLines(html)
  const start = lines.findIndex((line) => line === nome)
  const candidatos = (start >= 0 ? lines.slice(start + 1) : lines)
    .filter((line) => !/^(Origens|Fé e ciência|Perseguição|Páscoa|Minha oração)$/i.test(line))
    .filter((line) => !/^Outros santos e beatos/i.test(line))
    .filter((line) => line.length > 45)
    .filter((line) => !/Menu do Site|Buscar|Ajude a Canção Nova|Fontes:/i.test(line))

  const resumoCompleto = candidatos.slice(0, 2).join(" ").replace(/\s+/g, " ").trim()
  const resumo = resumoCompleto.length > 320 ? `${resumoCompleto.slice(0, 317).trim()}…` : resumoCompleto

  return { nome, resumo: resumo || undefined, fonte: SANTO_URL }
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 1800 },
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "User-Agent": "Mozilla/5.0 (compatible; ComunidadeSantaLuzia/1.1; +https://cancaonova.com/)",
    },
  })
  if (!response.ok) throw new Error(`Fonte respondeu com HTTP ${response.status}`)

  const bytes = await response.arrayBuffer()
  const contentType = response.headers.get("content-type") || ""
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase()

  try {
    return new TextDecoder(charset || "utf-8").decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
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
    const [liturgiaHtml, santoResult] = await Promise.all([
      fetchHtml(LITURGIA_URL),
      fetchHtml(SANTO_URL).catch(() => null),
    ])

    const liturgia = extractLiturgia(liturgiaHtml, dataIso)
    const santoDoDia = santoResult ? extractSanto(santoResult) : null

    if (!liturgia.liturgia || !liturgia.leituras.evangelho) {
      throw new Error("A estrutura da Liturgia Diária não pôde ser reconhecida.")
    }

    const payload: Liturgia = { ...liturgia, santoDoDia }
    cacheLiturgia = { dataIso, expiraEm: agora + CACHE_MS, payload }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=1500",
        "X-Santa-Luzia-Cache": "miss",
      },
    })
  } catch (error) {
    console.error("[Liturgia] Falha ao atualizar pela Canção Nova:", error)

    if (cacheLiturgia?.dataIso === dataIso) {
      return NextResponse.json(cacheLiturgia.payload, {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=900",
          "X-Santa-Luzia-Cache": "stale",
        },
      })
    }

    return NextResponse.json(
      { error: "Não foi possível atualizar a Liturgia Diária pela Canção Nova neste momento." },
      { status: 502 },
    )
  }
}
