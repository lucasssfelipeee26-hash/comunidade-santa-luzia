import { redirect } from "next/navigation"
import { GerenciadorRanking } from "@/components/gerenciador-ranking"
import { lerSessao } from "@/lib/auth"

export const dynamic = "force-dynamic"
export default async function GerenciarRankingPage(){const s=await lerSessao();if(!s)redirect("/area-restrita/login");if(s.tipo!=="moderador")redirect("/area-restrita/membro");return <GerenciadorRanking/>}
