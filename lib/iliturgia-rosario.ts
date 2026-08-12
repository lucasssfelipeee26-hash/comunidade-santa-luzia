export type MisterioRosario="alegria"|"dor"|"gloria"|"luz"

export function misterioRosarioDoDia(data:Date=new Date()):MisterioRosario{
 const dia=data.getDay()
 if(dia===2||dia===5)return "dor"
 if(dia===3||dia===0)return "gloria"
 if(dia===4)return "luz"
 return "alegria"
}

export function documentoRosarioDoDia(data:Date=new Date()){
 return `rosario/misterios_${misterioRosarioDoDia(data)}.htm`
}

export const misteriosRosario=[
 {id:"alegria",titulo:"Mistérios Gozosos",documento:"rosario/misterios_alegria.htm"},
 {id:"luz",titulo:"Mistérios Luminosos",documento:"rosario/misterios_luz.htm"},
 {id:"dor",titulo:"Mistérios Dolorosos",documento:"rosario/misterios_dor.htm"},
 {id:"gloria",titulo:"Mistérios Gloriosos",documento:"rosario/misterios_gloria.htm"},
] as const
