import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { AccountDeletionPanel } from "@/components/account-deletion-panel"
import { site } from "@/lib/site"

export const dynamic = "force-dynamic"

export default function ExcluirContaPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8e8_0%,#fff_34%,#faf7f1_100%)] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/privacidade" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Política de Privacidade</Link>
        <div className="my-5 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <ShieldCheck className="size-10 text-primary" />
          <h1 className="mt-3 font-serif text-3xl font-semibold text-primary">Exclusão de conta</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Este é o canal oficial de exclusão de conta do aplicativo {site.comunidade}. O procedimento também está acessível em “Meu perfil” dentro do aplicativo.</p>
          <div className="mt-6"><AccountDeletionPanel /></div>
        </div>
      </div>
    </main>
  )
}
