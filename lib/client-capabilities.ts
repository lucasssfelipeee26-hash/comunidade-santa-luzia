export function isWindowsBetaClient(request: Request) {
  const userAgent = request.headers.get("user-agent") || ""
  return /SantaLuziaWindowsBeta\//.test(userAgent) || request.headers.get("x-santa-luzia-windows-beta") === "1"
}

export function isNativeAndroidClient(request: Request) {
  const userAgent = request.headers.get("user-agent") || ""
  return /SantaLuziaNative\//.test(userAgent) || request.headers.get("x-santa-luzia-native") === "1"
}

/**
 * Clientes empacotados que mantêm a experiência completa local-first.
 * A versão Kotlin/Compose herda as mesmas regras funcionais da Beta rica,
 * sem precisar se identificar falsamente como Windows.
 */
export function isOfflineRichClient(request: Request) {
  return isWindowsBetaClient(request) || isNativeAndroidClient(request)
}
