"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
function Avatar({className,size="default",...props}:React.ComponentProps<"div">&{size?:"default"|"sm"|"lg"}){return <div data-slot="avatar" data-size={size} className={cn("group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none",size==="lg"&&"size-10",size==="sm"&&"size-6",className)} {...props}/>} 
function AvatarImage({className,onError,...props}:React.ComponentProps<"img">){const [failed,setFailed]=React.useState(false); if(failed||!props.src)return null; return <img data-slot="avatar-image" className={cn("aspect-square size-full rounded-full object-cover",className)} onError={(e)=>{setFailed(true);onError?.(e)}} {...props}/>} 
function AvatarFallback({className,...props}:React.ComponentProps<"div">){return <div data-slot="avatar-fallback" className={cn("absolute inset-0 -z-10 flex items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",className)} {...props}/>} 
function AvatarBadge({className,...props}:React.ComponentProps<"span">){return <span data-slot="avatar-badge" className={cn("absolute right-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-full bg-primary ring-2 ring-background",className)} {...props}/>} 
function AvatarGroup({className,...props}:React.ComponentProps<"div">){return <div data-slot="avatar-group" className={cn("flex -space-x-2",className)} {...props}/>} 
function AvatarGroupCount({className,...props}:React.ComponentProps<"div">){return <div data-slot="avatar-group-count" className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background",className)} {...props}/>} 
export {Avatar,AvatarImage,AvatarFallback,AvatarGroup,AvatarGroupCount,AvatarBadge}
