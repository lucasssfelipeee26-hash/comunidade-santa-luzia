export default function LiturgiaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <style>{`.mobile-app-bottom-nav{display:none!important}`}</style>
      {children}
    </>
  )
}
