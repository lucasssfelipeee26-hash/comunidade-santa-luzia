"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    setInstalled(standalone || iosStandalone)

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  if (installed || !promptEvent) return null

  async function instalar() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const escolha = await promptEvent.userChoice
    if (escolha.outcome === "accepted") setPromptEvent(null)
  }

  return (
    <button
      type="button"
      onClick={instalar}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c99a2e] bg-[#f6e7b7] px-4 py-3 text-sm font-bold text-[#681225] transition hover:bg-[#ecd58c]"
    >
      <Download className="size-4" aria-hidden="true" />
      Instalar aplicativo Santa Luzia
    </button>
  )
}
