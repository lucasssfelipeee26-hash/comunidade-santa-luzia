import { inicioAdvento, pascoa, semanaTempoComum, tempoLiturgico } from "@/lib/iliturgia-calendario"

const dias=["domingo","segunda","terca","quarta","quinta","sexta","sabado"] as const
const MS=86400000
function soData(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function diffDias(a:Date,b:Date){return Math.round((soData(b).getTime()-soData(a).getTime())/MS)}
function semanaDesde(inicio:Date,data:Date){return Math.floor(diffDias(inicio,data)/7)+1}

// Chaves que realmente possuem arquivo em Resources/missal/proprio/proprio do APK.
const propriosExistentes=new Set([
 "NSAparecida","NSCarmo","NSDores","NSGuadalupe","NSRainha","NSRosario","andreeambrosio","anjos","antoniogalvao","anunciacao","apresentacao","apresentacaoNS","arcanjos","ascensaodosenhor","assuncao","basilioegregorio","batismo","carlosborromeu","catedra","cinzas","conversaosaopaulo","cornelioecipriano","corpuschristi","cristoreidouniverso","divinamisericordia","epifania","exaltacao","franciscoxavier","icvm","imaculada","inaciodeantioquia","inaciodeazevedo","isabeldahungria","joaoevangelista","josedeanchieta","latrao","maedaigreja","martiriobatista","natividade","paixaodosenhor","pedroepaulo","pentecostes","policarpo","roquegonzalez","sagradafamilia","santaagueda","santacatarina","santacecilia","santaclara","santaescolastica","santaines","santaluzia","santamaria","santamarta","santamonica","santapaulina","santarosa","santateresa","santateresinha","santissimatrindade","santoafonso","santoagostinho","santoalberto","santoambrosio","santoandre","santoandrekim","santoantao","santoantonio","santoatanasio","santoestevao","santoinacio","santosinocentes","santotomas","saobarnabe","saobartolomeu","saobento","saobernardo","saoboaventura","saobonifacio","saocarloslwanga","saociriloemetodio","saodomingos","saofilipeetiago","saofilipeneri","saofrancisco","saofranciscosales","saogregorio","saojeronimo","saojmvianney","saojoao","saojoaobosco","saojoaocrisostomo","saojoaodacruz","saojoaquimesantana","saojosafa","saojose","saojustino","saoleao","saolourenco","saolucas","saoluisgonzaga","saomarcos","saomartinho","saomateus","saomatias","saomaximiliano","saopaulomiki","saopio","saopiox","saotiago","saotimoteoetito","saotome","saovicentedepaulo","scj","simaoejudas","stamariamadalena","todosossantos","transfiguracao","visitacao"
])

export function documentoMissalProprio(data:Date,chaveCelebracao?:string|null){
  if(chaveCelebracao&&propriosExistentes.has(chaveCelebracao))return `missal/proprio/proprio/${chaveCelebracao}.htm`

  const tempo=tempoLiturgico(data),dia=dias[data.getDay()]
  if(tempo==="tempocomum")return data.getDay()===0?`missal/proprio/tempocomum/${semanaTempoComum(data)}domingoTC.htm`:""

  if(tempo==="advento"){
    if(data.getMonth()===11&&data.getDate()>=17&&data.getDate()<=23)return `missal/proprio/advento/${data.getDate()}dezembroAD.htm`
    if(data.getMonth()===11&&data.getDate()===24)return "missal/proprio/advento/_24dezembroAD.htm"
    const semana=Math.max(1,Math.min(4,semanaDesde(inicioAdvento(data.getFullYear()),data)))
    // O APK não traz todos os dias das semanas 3 e 4. Não inventamos caminho.
    const disponiveis=new Set(["1domingo","1segunda","1terca","1quarta","1quinta","1sexta","1sabado","2domingo","2segunda","2terca","2quarta","2quinta","2sexta","2sabado","3domingo","3segunda","3terca","4domingo"])
    const chave=`${semana}${dia}`
    return disponiveis.has(chave)?`missal/proprio/advento/${chave}AD.htm`:""
  }

  if(tempo==="quaresma"){
    const p=pascoa(data.getFullYear()),cinzas=new Date(p);cinzas.setDate(cinzas.getDate()-46)
    const desdeCinzas=diffDias(cinzas,data)
    if(desdeCinzas===1)return "missal/proprio/quaresma/quinta_depoisdascinzas.htm"
    if(desdeCinzas===2)return "missal/proprio/quaresma/sexta_depoisdascinzas.htm"
    if(desdeCinzas===3)return "missal/proprio/quaresma/sabado_depoisdascinzas.htm"
    const primeiroDomingo=new Date(cinzas);primeiroDomingo.setDate(primeiroDomingo.getDate()+4)
    const semana=Math.max(1,Math.min(5,semanaDesde(primeiroDomingo,data)))
    return `missal/proprio/quaresma/${semana}${dia}QA.htm`
  }

  if(tempo==="pascoa"){
    const p=pascoa(data.getFullYear()),desdePascoa=diffDias(p,data)
    if(desdePascoa>=1&&desdePascoa<=6)return `missal/proprio/pascoa/${dia}_oitava.htm`
    const semana=Math.floor(desdePascoa/7)+1
    if(semana>=2&&semana<=7&&data.getDay()!==0)return `missal/proprio/pascoa/${semana}${dia}PA.htm`
    if(semana>=3&&semana<=6&&data.getDay()===0)return `missal/proprio/pascoa/${semana}domingoPA.htm`
    return ""
  }

  if(tempo==="natal"){
    const mes=data.getMonth()+1,d=data.getDate()
    if(mes===12&&d>=29&&d<=31)return `missal/proprio/natal/${d}dezembroNA.htm`
    if(mes===1&&data.getDay()!==0){const sufixo=d<=6?"antesdaepifania":"ateobatismo";return `missal/proprio/natal/${dia}_${sufixo}.htm`}
  }
  return ""
}
