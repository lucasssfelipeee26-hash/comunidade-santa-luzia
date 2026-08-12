"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { BookOpenText, BrainCircuit, CalendarDays, GraduationCap, Home, Library, LogIn } from "lucide-react"
import { PrayerPersonIcon } from "@/components/prayer-person-icon"

const publicItems=[{href:"/visitante",label:"Início",icon:Home},{href:"/visitante#liturgia",label:"Liturgia",icon:BookOpenText},{href:"/escala",label:"Escala",icon:CalendarDays},{href:"/biblioteca",label:"Biblioteca",icon:Library},{href:"/area-restrita/login",label:"Entrar",icon:LogIn}]
const areaItems=[{href:"/area-restrita",label:"Painel",custom:true},{href:"/escala",label:"Escala",icon:CalendarDays},{href:"/formacao",label:"Formação",icon:GraduationCap},{href:"/area-restrita/ranking",label:"Quiz",icon:BrainCircuit},{href:"/visitante",label:"Visitante",icon:Home}]
type MeNavResponse={sessao:null|{tipo:"moderador"|"membro"}}
const fetcher=(url:string)=>fetch(url,{cache:"no-store"}).then(r=>r.json())
const authPaths=["/area-restrita/login","/area-restrita/cadastro","/area-restrita/recuperar-senha"]
function ativo(pathname:string,href:string){const route=href.split("#")[0]||"/";if(href.includes("#"))return pathname===route;if(href==="/area-restrita")return["/area-restrita","/area-restrita/membro","/area-restrita/moderador"].includes(pathname);return pathname===route||(route!=="/"&&pathname.startsWith(`${route}/`))}

export function MobileBottomNav(){
 const pathname=usePathname();const ocultar=pathname==="/"||authPaths.some(p=>pathname.startsWith(p));const{data:me}=useSWR<MeNavResponse>(ocultar?null:"/api/auth/me",fetcher,{revalidateOnFocus:false,dedupingInterval:60_000});if(ocultar)return null
 const items=me?.sessao?areaItems:publicItems
 return <nav aria-label="Navegação principal" data-no-pull-refresh className="mobile-app-bottom-nav fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white/75 shadow-[0_10px_35px_rgba(55,28,20,.16)] backdrop-blur-2xl md:hidden"><div className="grid grid-cols-5" style={{paddingBottom:"max(env(safe-area-inset-bottom),2px)"}}>{items.map((item:any)=>{const active=ativo(pathname,item.href);const Icon=item.icon;return <Link prefetch={false} key={item.href} href={item.href} aria-current={active?"page":undefined} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 font-bold transition active:scale-95 ${active?"text-[#7b1326]":"text-[#786b68]"}`}><span className={`flex size-8 items-center justify-center rounded-xl transition ${active?"bg-[#7b1326] text-white shadow-md":"bg-white/70 text-[#7b1326]"}`}>{item.custom?<PrayerPersonIcon className="size-[19px]"/>:<Icon className="size-[18px]"/>}</span><span className="w-full truncate text-center text-[9px] leading-3">{item.label}</span></Link>})}</div></nav>
}
