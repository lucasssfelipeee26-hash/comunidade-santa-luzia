export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return
  const { iniciarProtecaoDadosSantaLuzia } = await import("@/lib/data-protection")
  iniciarProtecaoDadosSantaLuzia()
}
