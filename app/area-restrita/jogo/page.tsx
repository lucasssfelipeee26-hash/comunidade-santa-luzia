import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function JogoPage() {
  redirect("/area-restrita/ranking?aba=missao")
}
