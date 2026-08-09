"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
type CtxT={value:string,setValue:(v:string)=>void}; const TCtx=React.createContext<CtxT|null>(null)
function Tabs({className,defaultValue="",children,...props}:React.HTMLAttributes<HTMLDivElement>&{defaultValue?:string;orientation?:"horizontal"|"vertical"}){const [value,setValue]=React.useState(defaultValue);return <TCtx.Provider value={{value,setValue}}><div data-slot="tabs" className={cn("flex flex-col gap-2",className)} {...props}>{children}</div></TCtx.Provider>}
function TabsList({className,...props}:React.HTMLAttributes<HTMLDivElement>&{variant?:"default"|"line"}){return <div role="tablist" data-slot="tabs-list" className={cn("inline-flex w-fit items-center rounded-lg bg-muted p-[3px]",className)} {...props}/>} 
function TabsTrigger({className,value,children,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{value:string}){const c=React.useContext(TCtx);const active=c?.value===value;return <button role="tab" aria-selected={active} type="button" onClick={()=>c?.setValue(value)} className={cn("rounded-md px-2 py-1 text-sm",active&&"bg-background text-foreground shadow-sm",className)} {...props}>{children}</button>}
function TabsContent({className,value,...props}:React.HTMLAttributes<HTMLDivElement>&{value:string}){const c=React.useContext(TCtx);if(c?.value!==value)return null;return <div role="tabpanel" data-slot="tabs-content" className={cn("flex-1 text-sm outline-none",className)} {...props}/>} 
export {Tabs,TabsList,TabsTrigger,TabsContent}
