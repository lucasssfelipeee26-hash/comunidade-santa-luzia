"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

type AccordionCtx={open:string[],toggle:(v:string)=>void}
const Ctx=React.createContext<AccordionCtx|null>(null)
function Accordion({className,defaultValue=[],children,...props}:React.HTMLAttributes<HTMLDivElement>&{defaultValue?:string[]}){const [open,setOpen]=React.useState<string[]>(defaultValue);const toggle=(v:string)=>setOpen(s=>s.includes(v)?s.filter(x=>x!==v):[...s,v]);return <Ctx.Provider value={{open,toggle}}><div data-slot="accordion" className={cn("flex w-full flex-col",className)} {...props}>{children}</div></Ctx.Provider>}
const ItemCtx=React.createContext<string>("")
function AccordionItem({className,value,children,...props}:React.HTMLAttributes<HTMLDivElement>&{value:string}){return <ItemCtx.Provider value={value}><div data-slot="accordion-item" className={cn("not-last:border-b",className)} {...props}>{children}</div></ItemCtx.Provider>}
function AccordionTrigger({className,children,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>){const ctx=React.useContext(Ctx);const value=React.useContext(ItemCtx);const expanded=!!ctx?.open.includes(value);return <button type="button" aria-expanded={expanded} data-slot="accordion-trigger" onClick={()=>ctx?.toggle(value)} className={cn("group flex w-full items-start justify-between rounded-lg py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline",className)} {...props}>{children}<ChevronDownIcon className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform",expanded&&"rotate-180")}/></button>}
function AccordionContent({className,children,...props}:React.HTMLAttributes<HTMLDivElement>){const ctx=React.useContext(Ctx);const value=React.useContext(ItemCtx);if(!ctx?.open.includes(value))return null;return <div data-slot="accordion-content" className={cn("overflow-hidden pb-2.5 text-sm",className)} {...props}>{children}</div>}
export {Accordion,AccordionItem,AccordionTrigger,AccordionContent}
