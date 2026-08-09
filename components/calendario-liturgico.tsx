"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Liturgia } from "@/app/api/liturgia/route"
import type { TempoChave } from "@/lib/calendario"

type Tempo = {
  nome: TempoChave
  periodo: string
  cor: string
  corClasse: string
  descricao: string
}

const tempos: Tempo[] = [
  { nome: "Advento", periodo: "Do final de novembro até 24 de dezembro", cor: "Roxo", corClasse: "bg-[oklch(0.5_0.09_300)]", descricao: "Tempo de espera e preparação para o Natal do Senhor." },
  { nome: "Natal", periodo: "De 25 de dezembro até o Batismo do Senhor", cor: "Branco", corClasse: "bg-secondary border border-border", descricao: "Celebração do nascimento de Jesus Cristo." },
  { nome: "Tempo Comum (I)", periodo: "Após o Natal até a Quaresma", cor: "Verde", corClasse: "bg-[oklch(0.6_0.08_160)]", descricao: "Tempo de caminhada e crescimento na vida cristã." },
  { nome: "Quaresma", periodo: "Da Quarta-feira de Cinzas até a Semana Santa", cor: "Roxo", corClasse: "bg-[oklch(0.5_0.09_300)]", descricao: "Quarenta dias de conversão, oração, jejum e caridade." },
  { nome: "Tríduo Pascal e Páscoa", periodo: "Do Tríduo Pascal até Pentecostes", cor: "Branco", corClasse: "bg-secondary border border-border", descricao: "O centro do ano litúrgico: Paixão, Morte e Ressurreição do Senhor." },
  { nome: "Tempo Comum (II)", periodo: "Após Pentecostes até o Advento", cor: "Verde", corClasse: "bg-[oklch(0.6_0.08_160)]", descricao: "Retomada da caminhada até o fim do ano litúrgico." },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json())
function toRoman(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 40) return String(value)
  const pares: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
  let n = value
  let out = ""
  for (const [decimal, roman] of pares) {
    while (n >= decimal) {
      out += roman
      n -= decimal
    }
  }
  return out
}

function romanizarLiturgia(texto?: string) {
  if (!texto) return ""
  return texto.replace(/\b(\d{1,2})\s*(?:º|ª|°|o|a)(?=\s|$)/gi, (_, n) => toRoman(Number(n)))
}


export function CalendarioLiturgico() {
  const { data } = useSWR<Liturgia>("/api/liturgia", fetcher, { revalidateOnFocus: false })
  const atual = data?.tempoCategoria as TempoChave | undefined

  return (
    <div>
      {data?.tempoLiturgicoAtual && (
        <div className="mb-5 rounded-lg border border-[#d4af37]/40 bg-white/65 px-5 py-4 text-sm text-[#625c50]">
          <span className="font-semibold text-[#0b4b35]">Tempo litúrgico atual: </span>
          {romanizarLiturgia(data.tempoLiturgicoAtual)}
          <span className="ml-2 text-xs">· atualizado em conjunto com a Liturgia Diária da Canção Nova</span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tempos.map((t) => {
          const ativo = t.nome === atual
          return (
            <Card key={t.nome} className={`transition-shadow hover:shadow-md ${ativo ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
              <CardHeader>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block size-3 rounded-full ${t.corClasse}`} aria-hidden="true" />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cor: {t.cor}</span>
                  </div>
                  {ativo && <Badge className="bg-accent text-accent-foreground">Estamos aqui</Badge>}
                </div>
                <CardTitle className="font-serif text-2xl text-primary">{t.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm font-medium text-foreground">{t.periodo}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{t.descricao}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
