import * as React from "react"
import { cn } from "@/lib/utils"
type Props=React.HTMLAttributes<HTMLDivElement>&{orientation?:"horizontal"|"vertical"}
function Separator({className,orientation="horizontal",...props}:Props){return <div role="separator" aria-orientation={orientation} data-slot="separator" className={cn("shrink-0 bg-border",orientation==="horizontal"?"h-px w-full":"w-px self-stretch",className)} {...props}/>} 
export { Separator }
