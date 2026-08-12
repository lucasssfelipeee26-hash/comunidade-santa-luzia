import { tempoLiturgico } from "@/lib/iliturgia-calendario"

export type ItemILiturgia={id:string;titulo:string;documento:string}

export const oracoesILiturgia:ItemILiturgia[]=[
 {id:"angelus",titulo:"Angelus",documento:"oficio/outros/angelus.htm"},
 {id:"angelus-latim",titulo:"Angelus em latim",documento:"oficio/outros/angelus_latim.htm"},
 {id:"antifonas-marianas",titulo:"Antífonas Marianas",documento:"oficio/outros/antifonas_marianas.htm"},
 {id:"ato-contricao",titulo:"Ato de Contrição",documento:"oficio/outros/atodecontricao.htm"},
 {id:"ato-penitencial",titulo:"Ato Penitencial",documento:"oficio/outros/atopenitencial.htm"},
 {id:"ave-maria-latim",titulo:"Ave-Maria em latim",documento:"oficio/outros/avemarialatim.htm"},
 {id:"bencao-santissimo",titulo:"Bênção do Santíssimo",documento:"oficio/outros/bencao_santissimo.htm"},
 {id:"benedictus",titulo:"Benedictus",documento:"oficio/outros/benedictus.htm"},
 {id:"consagracao-ns",titulo:"Consagração a Nossa Senhora",documento:"oficio/outros/consagracaonossasenhora.htm"},
 {id:"credo-niceno",titulo:"Credo Niceno-Constantinopolitano",documento:"oficio/outros/credoniceno.htm"},
 {id:"formulas-completas",titulo:"Fórmulas para Completas",documento:"oficio/outros/formulascompletas.htm"},
 {id:"pai-nosso",titulo:"Fórmulas do Pai-Nosso",documento:"oficio/outros/formulaspainosso.htm"},
 {id:"gloria",titulo:"Glória",documento:"oficio/outros/gloria.htm"},
 {id:"hinos-latim",titulo:"Hinos em latim",documento:"oficio/outros/hinosemlatim.htm"},
 {id:"ladainha-santos",titulo:"Ladainha de Todos os Santos",documento:"oficio/outros/ladainhatodosossantos.htm"},
 {id:"magnificat",titulo:"Magnificat",documento:"oficio/outros/magnificat.htm"},
 {id:"magnificat-latim",titulo:"Magnificat em latim",documento:"oficio/outros/magnificat_latim.htm"},
 {id:"nunc-dimittis",titulo:"Nunc Dimittis",documento:"oficio/outros/nuncdimittis.htm"},
 {id:"pai-nosso-latim",titulo:"Pai-Nosso em latim",documento:"oficio/outros/painossolatim.htm"},
 {id:"paramentacao",titulo:"Orações para a paramentação",documento:"oficio/outros/paramentacao.htm"},
 {id:"pos-missa",titulo:"Orações após a Missa",documento:"oficio/outros/posmissa.htm"},
 {id:"preparacao-confissao",titulo:"Preparação para a Confissão",documento:"oficio/outros/preparacao_confissao.htm"},
 {id:"preparacao-missa",titulo:"Preparação para a Missa",documento:"oficio/outros/preparacaomissa.htm"},
 {id:"reconciliacao",titulo:"Reconciliação individual",documento:"oficio/outros/reconciliacaoindividual.htm"},
 {id:"salve-rainha",titulo:"Salve Rainha",documento:"oficio/outros/salverainha.htm"},
 {id:"te-deum",titulo:"Te Deum",documento:"oficio/outros/tedeum.htm"},
 {id:"te-deum-latim",titulo:"Te Deum em latim",documento:"oficio/outros/tedeum_latim.htm"},
 {id:"veni-creator",titulo:"Veni Creator",documento:"oficio/outros/venicreator.htm"},
 {id:"via-sacra",titulo:"Via-Sacra",documento:"oficio/outros/viasacra.htm"},
]

const comentariosArquivos=[
 "1Sm161b671013aEf5814Jo9141","2Sm513Cl11220Lc233543","2Sm7158b1214a16Lc16779","Eclo1516211Cor2610Mt51737","Eclo3371417aCl31221Mt213151923","Ex1737Rm51258Jo4542","Ez371214Rm8811Jo11145","Gn1214a2Tm18b10Mt1719","Gn279317Rm51219Mt4111","Gn391520Ef1361112Lc12638","Is11110Rm1549Mt3112","Is215Rm131114aMt243744","Is3516a10Tg5710Mt11211","Is421467At103438Mt31317","Is493561Cor113Jo12934","Is52710Hb116Jo1118","Is587101Cor215Mt51316","Is6016Ef323a56Mt2112","Is71014Rm117Mt11824","Is823b931Cor1101317Mt41223","Jl212182Cor52062Mt6161618","Lv191217181Cor31623Mt53848","Ml314Hb21418Lc22240","Nm62227Gl447Lc21621","Sf23312131Cor12631Mt5112a"
]

export const comentariosILiturgia:ItemILiturgia[]=comentariosArquivos.map((nome,i)=>({id:`comentario-${i+1}`,titulo:`Comentário litúrgico ${i+1}`,documento:`comentarios/${nome}.htm`}))

export const invitatorioILiturgia:ItemILiturgia={id:"invitatorio",titulo:"Invitatório",documento:"oficio/invitatorio.html"}
export const indiceGeralILiturgia:ItemILiturgia={id:"indice-geral",titulo:"Instrução Geral sobre a Liturgia das Horas",documento:"IGLH.htm"}

export function vigiliaILiturgia(data:Date):ItemILiturgia[]{
 const tempo=tempoLiturgico(data)
 const pasta=tempo==="tempocomum"?"tempocomum":tempo==="advento"?"advento":tempo==="quaresma"?"quaresma":tempo==="pascoa"?"pascoa":"natal"
 const quantidades:Record<string,number>={tempocomum:8,advento:4,quaresma:5,pascoa:6,natal:0}
 const itens:ItemILiturgia[]=[{id:"vigilia-canticos",titulo:"Cânticos da Vigília",documento:`oficio/${pasta}/horas/vigilia_canticos.htm`}]
 const total=quantidades[pasta]||0
 for(let i=1;i<=total;i++){
  if(pasta==="pascoa"&&i===1)continue
  itens.push({id:`vigilia-evangelho-${i}`,titulo:`Evangelho da Vigília ${i}`,documento:`oficio/${pasta}/horas/vigilia_evangelho_${i}.htm`})
 }
 return itens
}
