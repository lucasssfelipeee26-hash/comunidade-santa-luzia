import { LiturgiaPageNavigation } from "@/components/liturgia-page-navigation"

export default function LiturgiaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <style>{`
        .mobile-app-bottom-nav{display:none!important}
        .liturgical-document{
          height:clamp(390px,58dvh,650px)!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          column-fill:auto!important;
          column-gap:24px!important;
          scrollbar-width:none!important;
          scroll-behavior:smooth!important;
          overscroll-behavior-x:contain;
          touch-action:pan-x pan-y;
          margin-top:.75rem!important;
          padding-bottom:.25rem;
        }
        .liturgical-document::-webkit-scrollbar{display:none!important}
        .liturgical-document img{max-height:180px!important;width:auto!important}
        @media (min-width:640px){
          .liturgical-document{height:clamp(460px,64dvh,720px)!important}
          .liturgical-document img{max-height:240px!important}
        }
      `}</style>
      {children}
      <LiturgiaPageNavigation />
    </>
  )
}
