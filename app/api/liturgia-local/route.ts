import { NextResponse } from "next/server"
import { ciclosLiturgicos, dataIsoParaDate } from "@/lib/ciclo-liturgico"
import { dataCuiabaIso, obterLiturgiaLocal, type LiturgiaLocal, type LeituraLocal } from "@/lib/liturgia-local"
import { liturgiaDoArquivoLecionario } from "@/lib/iliturgia-lecionario-offline"
import { liturgiaDoIndiceAnual } from "@/lib/iliturgia-indice-anual"
import { documentoLecionarioDasLeituras } from "@/lib/iliturgia-conteudo-dia"
import { tempoLiturgico } from "@/lib/iliturgia-calendario"
import { celebracaoDoDiaBrasil, imagemCelebracao } from "@/lib/iliturgia-sanctoral-brasil"

export const dynamic = "force-dynamic"

function dataPorExtenso(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)))
}

function refs(itens?:string[]):LeituraLocal[]{return (itens||[]).filter(Boolean).map(referencia=>({referencia}))}
function nomeTempo(chave:ReturnType<typeof tempoLiturgico>){
  return ({advento:"Advento",natal:"Natal",quaresma:"Quaresma",pascoa:"Tempo Pascal",tempocomum:"Tempo Comum"} as const)[chave]
}

function aplicarCalendarioBrasil(local: LiturgiaLocal, dataIso: string): LiturgiaLocal {
  const indice = liturgiaDoIndiceAnual(dataIso)
  const celebracao = celebracaoDoDiaBrasil(dataIsoParaDate(dataIso))
  return {
    ...local,
    liturgia: indice?.liturgia || local.liturgia,
    cor: indice?.cor || local.cor,
    santoDoDia: celebracao ? { nome: celebracao.nome, imagem: imagemCelebracao(celebracao) } : null,
  }
}

async function montarDoIndice(dataIso:string):Promise<LiturgiaLocal|null>{
  const indice=liturgiaDoIndiceAnual(dataIso)
  if(!indice)return null
  const data=dataIsoParaDate(dataIso)
  const tempo=tempoLiturgico(data)
  const celebracao=celebracaoDoDiaBrasil(data)
  const leituras={
    primeiraLeitura:refs(indice.primeiraLeitura),
    salmo:refs(indice.salmo),
    segundaLeitura:refs(indice.segundaLeitura),
    evangelho:refs(indice.evangelho),
  }
  const base:LiturgiaLocal={
    data:dataPorExtenso(dataIso),
    liturgia:indice.liturgia||(celebracao?.nome||nomeTempo(tempo)),
    cor:indice.cor||"Verde",
    tempoLiturgicoAtual:nomeTempo(tempo),
    tempoCategoria:tempo,
    santoDoDia:celebracao?{nome:celebracao.nome,imagem:imagemCelebracao(celebracao)}:null,
    fonte:{nome:"Acervo offline iLiturgia"},
    leituras,
  }
  const caminho=documentoLecionarioDasLeituras(leituras.primeiraLeitura,leituras.segundaLeitura,leituras.evangelho)
  if(!caminho)return base
  try{
    const {leituras:_leituras,...semLeituras}=base
    const extraida=await liturgiaDoArquivoLecionario(caminho,semLeituras)
    return extraida||base
  }catch(error){
    console.error(`[Liturgia offline] Não foi possível resolver ${dataIso} em ${caminho}:`,error)
    return base
  }
}

export async function GET() {
  const dataIso = dataCuiabaIso()
  const ciclos = ciclosLiturgicos(dataIsoParaDate(dataIso))
  const localOriginal = obterLiturgiaLocal(dataIso)
  let local:LiturgiaLocal|null=localOriginal

  if(localOriginal){
    const arquivoOrigem = localOriginal.fonte?.arquivoOrigem?.replace(/^assets\/Resources\//, "")
    if (arquivoOrigem?.toLowerCase().startsWith("lecionario/")) {
      try {
        const { leituras: _leituras, ...base } = localOriginal
        const extraida = await liturgiaDoArquivoLecionario(arquivoOrigem, base)
        if (extraida && (extraida.leituras.primeiraLeitura?.length || extraida.leituras.evangelho?.length)) local = extraida
      } catch (error) {
        console.error("[Liturgia offline] Falha ao estruturar o Lecionário incorporado:", error)
      }
    }
  }else{
    local=await montarDoIndice(dataIso)
  }

  if (!local) {
    return NextResponse.json({
      erro: "A Liturgia de hoje ainda não está disponível na base offline.",
      offline: true,
      dataIso,
      quizDisponivel: false,
    }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }

  local = aplicarCalendarioBrasil(local, dataIso)

  const temTexto=Boolean(local.leituras?.primeiraLeitura?.some(x=>x.texto)||local.leituras?.evangelho?.some(x=>x.texto))
  return NextResponse.json({
    ...local,
    dataIso,
    data: local.data || dataPorExtenso(dataIso),
    cicloDominical: ciclos.cicloDominical,
    cicloFerial: ciclos.cicloFerial,
    anoLiturgico: ciclos.anoLiturgico,
    origem: "offline",
    offline: true,
    quizDisponivel: temTexto,
    fonte: {
      nome: local.fonte?.nome || "Base offline Santa Luzia",
      ...(local.fonte?.licenca ? { licenca: local.fonte.licenca } : {}),
      ...(local.fonte?.arquivoOrigem ? { arquivoOrigem: local.fonte.arquivoOrigem } : {}),
    },
    santoDoDia: local.santoDoDia ? { ...local.santoDoDia, fonte: "Base offline" } : null,
  }, { headers: { "Cache-Control": "public, max-age=3600" } })
}
