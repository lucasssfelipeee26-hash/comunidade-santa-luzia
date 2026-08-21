"use client"

import { useEffect, useState } from "react"
import { MonitorCog } from "lucide-react"

const WINDOWS_BETA_UA = "SantaLuziaWindowsBeta/"

export function WindowsBetaRuntime() {
  const [ativo, setAtivo] = useState(false)
  const [versao, setVersao] = useState("")

  useEffect(() => {
    const userAgent = navigator.userAgent || ""
    const indice = userAgent.indexOf(WINDOWS_BETA_UA)
    if (indice < 0) return

    const trecho = userAgent.slice(indice + WINDOWS_BETA_UA.length)
    const betaVersion = trecho.split(/\s/)[0] || "beta"
    document.documentElement.dataset.nativePlatform = "windows-beta"
    document.documentElement.dataset.windowsBeta = betaVersion
    document.body.classList.add("windows-beta-shell")
    setVersao(betaVersion)
    setAtivo(true)

    return () => {
      document.body.classList.remove("windows-beta-shell")
      delete document.documentElement.dataset.windowsBeta
    }
  }, [])

  if (!ativo) return null

  return (
    <div
      data-no-pull-refresh
      aria-label={`Santa Luzia Beta Windows ${versao}`}
      className="windows-beta-badge"
    >
      <MonitorCog aria-hidden="true" />
      <span>Beta Windows</span>
      <strong>{versao}</strong>
    </div>
  )
}
