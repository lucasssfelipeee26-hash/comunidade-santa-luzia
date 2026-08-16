"use client"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#fffaf6", color: "#2c2024", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "100%", maxWidth: 440, border: "1px solid #e5d9dc", borderRadius: 28, background: "#fff", padding: 28, textAlign: "center", boxShadow: "0 18px 55px rgba(79,36,49,.10)" }}>
            <div style={{ width: 54, height: 54, margin: "0 auto", borderRadius: 18, display: "grid", placeItems: "center", background: "#f4e7ea", color: "#713044", fontSize: 26 }}>✦</div>
            <h1 style={{ margin: "18px 0 8px", color: "#713044", fontSize: 25 }}>O Santa Luzia encontrou uma falha</h1>
            <p style={{ margin: 0, color: "#6f6065", lineHeight: 1.55, fontSize: 14 }}>Seus dados já salvos permanecem protegidos. Tente recuperar a tela; se a falha persistir, recarregue o aplicativo.</p>
            <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
              <button type="button" onClick={reset} style={{ minHeight: 48, border: 0, borderRadius: 16, background: "#713044", color: "#fff", fontWeight: 700, fontSize: 14 }}>Tentar novamente</button>
              <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, border: "1px solid #dfd2d6", borderRadius: 16, background: "#fff", color: "#5a2938", fontWeight: 700, fontSize: 13 }}>Recarregar aplicativo</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
