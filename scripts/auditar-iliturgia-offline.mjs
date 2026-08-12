import { readFile } from "node:fs/promises"
import { gunzipSync } from "node:zlib"
import path from "node:path"

const raiz=process.cwd()
const pacotes={
  catequeses:["catequeses.html.json.gz"],comentarios:["comentarios.html.json.gz"],evangelho:["evangelhos.html.json.gz"],geral:["gerais.html.json.gz"],
  lecionario:["lecionario.html.json.gz"],missal:["missal.html.json.gz"],rosario:["rosario.html.json.gz"],salterio:["salterio.html.json.gz"],
  oficio:Array.from({length:10},(_,i)=>`oficio-${String(i+1).padStart(2,"0")}.html.json.gz`),
}
const docs=new Map()
for(const [cat,arquivos] of Object.entries(pacotes)){
  for(const nome of arquivos){
    const bin=await readFile(path.join(raiz,nome))
    const pacote=JSON.parse(gunzipSync(bin).toString("utf8"))
    for(const d of pacote.documents||[])docs.set(String(d.path||d.id).toLowerCase(),{...d,categoria:cat})
  }
}
const obrigatorios=[
  "IGLH.htm","oficio/invitatorio.html","salterio/salterio.htm",
  "missal/ordinario/ritosiniciais.htm","missal/ordinario/liturgiapalavra.htm","missal/ordinario/liturgiaeucaristica.htm","missal/ordinario/ritocomunhao.htm","missal/ordinario/ritosfinais.htm",
  "rosario/misterios_alegria.htm","rosario/misterios_luz.htm","rosario/misterios_dor.htm","rosario/misterios_gloria.htm",
  ...["I","II","III","IV","V","VI-A","VI-B","VI-C","VI-D","VII","VIII","IX","X","XI"].map(n=>`missal/oracaoeucaristica/oracaoeucaristica${n}.htm`),
]
const faltando=obrigatorios.filter(p=>!docs.has(p.toLowerCase()))
const totais={}
for(const d of docs.values())totais[d.categoria]=(totais[d.categoria]||0)+1
console.log("Auditoria iLiturgia offline")
console.log("Documentos:",docs.size)
console.table(totais)
if(faltando.length){console.error("Documentos essenciais ausentes:",faltando);process.exit(1)}
if(docs.size<5400){console.error(`Acervo incompleto: ${docs.size} documentos.`);process.exit(1)}
console.log("OK: acervo essencial presente e íntegro.")