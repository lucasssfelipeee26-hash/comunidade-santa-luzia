"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { KeyRound, Loader2, UserPlus } from "lucide-react"
import { AppRuntime } from "@/components/app-runtime"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { NavigationProgress } from "@/components/navigation-progress"
import { OfflineLiturgiaRuntime } from "@/components/offline-liturgia-runtime"
import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { DeferredLiturgia } from "@/components/home-deferred"
import { SiteFooter } from "@/components/site-footer"
import { CentralLiturgicaILiturgia } from "@/components/central-liturgica-iliturgia"
import { EscalaPublica } from "@/components/escala-publica"
import { BibliotecaCatolica } from "@/components/biblioteca-catolica"
import { AuthShell } from "@/components/auth-shell"
import { LoginForm } from "@/components/login-form"
import { CadastroForm } from "@/components/cadastro-form"
import { RecuperarSenhaForm } from "@/components/recuperar-senha-form"
import { MembroDashboard } from "@/components/membro-dashboard"
import { ModeradorDashboard } from "@/components/moderador-dashboard"
import { CentralAtrasos } from "@/components/central-atrasos"
import { FormacaoMembros } from "@/components/formacao-membros"
import { RankingInterativo } from "@/components/ranking-interativo"
import { PerfisEquipe } from "@/components/perfis-equipe"
import { PerfilModerador } from "@/components/perfil-moderador"
import { ModeradorEscalaPage } from "@/components/moderador-escala-page"
import { ModeradorFormacaoPage } from "@/components/moderador-formacao-page"
import { ModeradorPresencasPage } from "@/components/moderador-presencas-page"
import { NovoRegistroModerador } from "@/components/novo-registro-moderador"
import { GerenciadorRanking } from "@/components/gerenciador-ranking"
import { GerenciadorTema } from "@/components/gerenciador-tema"
import { ImportarAcervoLiturgico } from "@/components/importar-acervo-liturgico"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { PrayerPersonIcon } from "@/components/prayer-person-icon"
import { StoreProvider, useStore } from "@/lib/store"
import { TEMA_PADRAO, temaValido, type TemaSite } from "@/lib/site-theme-shared"
import { site } from "@/lib/site"
import { usePathname, useRouter } from "next/navigation"

const atalhos = [
  ["Centro Litúrgico", "Liturgia diária, Liturgia das Horas, Rosário, guia da Missa e calendário.", "/liturgia", "Abrir centro"],
  ["Escala do Dia", "Veja as escalas publicadas e as funções de cada celebração.", "/escala", "Ver escala"],
  ["Biblioteca", "Acesse o catálogo católico disponibilizado para consulta.", "/biblioteca", "Abrir biblioteca"],
] as const

function Loading({ texto = "Carregando…" }: { texto?: string }) {
  return <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />{texto}</div>
}

function PublicHome() {
  return <div className="public-home min-h-screen bg-[#fffaf0]">
    <SiteHeader />
    <main>
      <Hero />
      <section className="relative z-10 bg-[#fffaf0] py-8 sm:py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-3 sm:gap-4 sm:px-4 lg:grid-cols-3 lg:px-6">
          {atalhos.map(([title, text, href, cta]) => <a key={href} href={href} className="group min-w-0 rounded-2xl border border-[#d9cfb9] bg-[#fffdf7] p-4 shadow-[0_6px_20px_rgba(72,55,21,.07)] transition active:scale-[.985] sm:p-6">
            <h2 className="font-serif text-lg font-semibold leading-tight text-[#173d2d] sm:text-2xl">{title}</h2>
            <p className="mt-2 text-xs leading-5 text-[#5f5a4e] sm:text-sm sm:leading-relaxed">{text}</p>
            <span className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wide text-[#9a731d] sm:text-xs">{cta} →</span>
          </a>)}
        </div>
      </section>
      <section id="liturgia" className="mx-auto max-w-7xl scroll-mt-24 px-3 py-10 sm:px-4 sm:py-14 lg:px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#9a731d]">Palavra de Deus</p>
        <h1 className="font-serif text-3xl font-semibold text-[#0b4b35] sm:text-5xl">Liturgia Diária</h1>
        <p className="mb-6 mt-3 max-w-2xl text-sm leading-6 text-[#665f50] sm:text-base">Conteúdo atualizado para preparar o coração e o serviço em cada celebração.</p>
        <DeferredLiturgia />
      </section>
    </main>
    <SiteFooter />
  </div>
}

function LiturgiaRoute() {
  return <div className="min-h-screen bg-[#fffaf0]"><SiteHeader /><main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8 lg:px-6"><CentralLiturgicaILiturgia /></main><SiteFooter /></div>
}

function EscalaRoute() {
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-12"><p className="text-sm uppercase tracking-[.2em] text-accent-foreground/70">Serviço do altar</p><h1 className="mt-2 font-serif text-4xl font-semibold text-primary">Escala do Dia</h1><p className="mb-8 mt-3 text-muted-foreground">Consulte as escalas publicadas com o sacerdote celebrante, acólitos, coroinhas e suas funções.</p><EscalaPublica /></main><SiteFooter /></div>
}

function BibliotecaRoute() {
  return <div className="min-h-screen bg-[#fffaf0]"><SiteHeader /><main className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10"><BibliotecaCatolica /></main><SiteFooter /></div>
}

function LoginRoute() {
  return <AuthShell icon={<PrayerPersonIcon className="size-7" />} titulo="Bem-vindo ao Santa Luzia" subtitulo="Entre para abrir seu painel ou continue como visitante" rodape="Seu acesso permanece neste aparelho até você sair."><LoginForm /></AuthShell>
}

function CadastroRoute() {
  return <AuthShell icon={<UserPlus className="size-6" />} titulo="Cadastro de Acólito / Coroinha" subtitulo={`Solicite seu acesso à área restrita da ${site.comunidade}`} voltarHref="/area-restrita/login" voltarLabel="Voltar ao login"><p className="mb-6 text-pretty text-sm leading-relaxed text-muted-foreground">Preencha seus dados abaixo. O moderador da equipe precisa aprovar o cadastro antes que você possa entrar.</p><CadastroForm /></AuthShell>
}

function RecuperarRoute() {
  return <AuthShell icon={<KeyRound className="size-6" />} titulo="Recuperar senha" subtitulo={`Área restrita da ${site.comunidade}`} voltarHref="/area-restrita/login" voltarLabel="Voltar ao login"><RecuperarSenhaForm /></AuthShell>
}

function useGuard(tipo?: "membro" | "moderador") {
  const store = useStore()
  const router = useRouter()
  useEffect(() => {
    if (!store.ready) return
    if (!store.sessao) router.replace("/area-restrita/login")
    else if (tipo && store.sessao.tipo !== tipo) router.replace(store.sessao.tipo === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro")
  }, [store.ready, store.sessao, tipo, router])
  return store
}

function AreaIndexRoute() {
  const { ready, sessao } = useStore()
  const router = useRouter()
  useEffect(() => { if (ready) router.replace(sessao?.tipo === "moderador" ? "/area-restrita/moderador" : sessao ? "/area-restrita/membro" : "/area-restrita/login") }, [ready, sessao, router])
  return <Loading />
}

function MemberRoute() {
  const store = useGuard("membro")
  if (!store.ready || !store.sessao || store.sessao.tipo !== "membro" || !store.membroAtual) return <Loading texto="Abrindo seu perfil…" />
  return <MembroDashboard membro={store.membroAtual} />
}

function ModeratorRoute() {
  const store = useGuard("moderador")
  if (!store.ready || !store.sessao || store.sessao.tipo !== "moderador") return <Loading texto="Abrindo painel…" />
  return <ModeradorDashboard />
}

function Guarded({ children, tipo }: { children: React.ReactNode; tipo?: "membro" | "moderador" }) {
  const store = useGuard(tipo)
  if (!store.ready || !store.sessao || (tipo && store.sessao.tipo !== tipo)) return <Loading />
  return <>{children}</>
}

function FormacaoRoute() {
  const { sessao } = useGuard()
  if (!sessao) return <Loading />
  return <div className="min-h-screen bg-[#fffaf0]"><AreaHeader titulo="Formação" subtitulo="Conteúdos, temas e avisos para acólitos e coroinhas" voltarHref={sessao.tipo === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro"} /><main className="mx-auto max-w-6xl px-4 py-10"><div className="mb-8 rounded-xl border border-[#d4af37]/35 bg-[#073b29] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e9c75b]">Acólitos e Coroinhas São Padre Pio</p><h1 className="mt-2 font-serif text-4xl text-[#f2cf62]">Central de Formação</h1><p className="mt-3 max-w-3xl text-white/80">Veja o tema da próxima formação, eventuais avisos de cancelamento e baixe os materiais disponibilizados pelo moderador.</p></div><FormacaoMembros /></main></div>
}

type AuthMe = { sessao: null | { tipo: "membro" | "moderador"; usuario: { id: string; nome: string } } }
function RankingRoute() {
  const store = useGuard()
  const [usuario, setUsuario] = useState<{ id: string; nome: string; tipo: "membro" | "moderador" } | null>(null)
  useEffect(() => {
    if (!store.sessao) return
    let ativo = true
    void fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" }).then(r => r.json()).then((j: AuthMe) => { if (ativo && j?.sessao?.usuario?.id) setUsuario({ ...j.sessao.usuario, tipo: j.sessao.tipo }) }).catch(() => {})
    return () => { ativo = false }
  }, [store.sessao])
  if (!store.sessao || !usuario) return <Loading texto="Abrindo Jornada Litúrgica…" />
  return <RankingInterativo usuarioInicial={usuario} />
}

function PerfisRoute() {
  const { sessao } = useGuard()
  if (!sessao) return <Loading />
  return <PerfisEquipe tipoUsuario={sessao.tipo} />
}

function PerfilIndividualRoute({ id }: { id: string }) {
  const store = useGuard("moderador")
  if (!store.sessao || store.sessao.tipo !== "moderador") return <Loading />
  const membro = store.membros.find(m => m.id === id)
  return membro ? <PerfilModerador membro={membro} /> : <Loading texto="Carregando perfil…" />
}

function TemaRoute() {
  const [tema, setTema] = useState<TemaSite>(TEMA_PADRAO)
  useEffect(() => {
    let ativo = true
    void fetch("/api/configuracao/tema", { cache: "no-store" }).then(r => r.json()).then(j => {
      const valor = j?.tema || j?.configuracao?.tema
      if (ativo && temaValido(valor)) { setTema(valor); document.documentElement.dataset.siteTheme = valor }
    }).catch(() => {})
    return () => { ativo = false }
  }, [])
  return <div className="min-h-screen bg-background"><AreaHeader titulo="Cores do Site" subtitulo="Temas inspirados em Santa Luzia" voltarHref="/area-restrita/moderador" voltarLabel="Voltar ao painel" menu={<ModeradorMenu />} /><main className="mx-auto max-w-6xl px-4 py-8"><GerenciadorTema temaInicial={tema} /></main></div>
}

function AcervoRoute() {
  return <div className="min-h-screen bg-[#fffaf0]"><AreaHeader titulo="Acervo Litúrgico Offline" subtitulo="Instalação e atualização da biblioteca autorizada" voltarHref="/area-restrita/moderador" menu={<ModeradorMenu />} /><main className="mx-auto max-w-5xl px-3 py-5 pb-24 sm:px-4 sm:py-8"><ImportarAcervoLiturgico /></main></div>
}

function RouterView() {
  const pathname = usePathname()
  const perfilId = useMemo(() => pathname.match(/^\/area-restrita\/perfil\/([^/]+)$/)?.[1] || "", [pathname])

  if (pathname === "/" || pathname === "/visitante") return <PublicHome />
  if (pathname === "/liturgia") return <LiturgiaRoute />
  if (pathname === "/escala") return <EscalaRoute />
  if (pathname === "/biblioteca") return <BibliotecaRoute />
  if (pathname === "/formacao") return <FormacaoRoute />
  if (pathname === "/area-restrita/login") return <LoginRoute />
  if (pathname === "/area-restrita/cadastro") return <CadastroRoute />
  if (pathname === "/area-restrita/recuperar-senha") return <RecuperarRoute />
  if (pathname === "/area-restrita") return <AreaIndexRoute />
  if (pathname === "/area-restrita/membro") return <MemberRoute />
  if (pathname === "/area-restrita/moderador") return <ModeratorRoute />
  if (pathname === "/area-restrita/atrasos") return <Guarded><CentralAtrasos /></Guarded>
  if (pathname === "/area-restrita/ranking" || pathname === "/area-restrita/jogo") return <RankingRoute />
  if (pathname === "/area-restrita/perfis") return <PerfisRoute />
  if (perfilId) return <PerfilIndividualRoute id={decodeURIComponent(perfilId)} />
  if (pathname === "/area-restrita/moderador/escala") return <Guarded tipo="moderador"><ModeradorEscalaPage /></Guarded>
  if (pathname === "/area-restrita/moderador/formacao") return <Guarded tipo="moderador"><ModeradorFormacaoPage /></Guarded>
  if (pathname === "/area-restrita/moderador/presencas") return <Guarded tipo="moderador"><ModeradorPresencasPage /></Guarded>
  if (pathname === "/area-restrita/moderador/registro") return <Guarded tipo="moderador"><NovoRegistroModerador /></Guarded>
  if (pathname === "/area-restrita/moderador/ranking") return <Guarded tipo="moderador"><GerenciadorRanking /></Guarded>
  if (pathname === "/area-restrita/moderador/tema") return <Guarded tipo="moderador"><TemaRoute /></Guarded>
  if (pathname === "/area-restrita/moderador/acervo-liturgico") return <Guarded tipo="moderador"><AcervoRoute /></Guarded>
  return <PublicHome />
}

function LocalApp() {
  useEffect(() => {
    document.documentElement.dataset.nativePlatform = "android"
    document.documentElement.dataset.siteTheme ||= TEMA_PADRAO
    document.body.classList.add("app-mobile-shell", "font-sans", "antialiased")
  }, [])

  return <AppRuntime><NavigationProgress /><OfflineLiturgiaRuntime /><StoreProvider><RouterView /></StoreProvider><MobileBottomNav /></AppRuntime>
}

const rootNode = document.getElementById("root")
if (!rootNode) throw new Error("Santa Luzia local root ausente")
createRoot(rootNode).render(<LocalApp />)
