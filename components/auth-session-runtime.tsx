"use client"

import { createContext, useContext, useEffect, useMemo } from "react"
import useSWR, { type KeyedMutator } from "swr"
import { authJson, validSession } from "@/lib/auth-client"
import { carregarSessaoOffline, limparDadosPrivadosOffline, salvarSessaoOffline } from "@/lib/offline-data"

export type AuthSessionUser = {
  id: string
  nome: string
  usuario?: string
  email: string
  funcao: string | null
  desde: string | null
  status: "pendente" | "aprovado" | "recusado"
}

export type AuthSessionResponse = {
  sessao: null | { tipo: "moderador" | "membro"; usuario: AuthSessionUser }
}

type AuthSessionContextValue = {
  ready: boolean
  liveAuthenticated: boolean
  liveSession: AuthSessionResponse["sessao"]
  sessao: AuthSessionResponse["sessao"]
  refresh: KeyedMutator<AuthSessionResponse>
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

async function fetchLiveSession(): Promise<AuthSessionResponse> {
  const json = await authJson("/api/auth/me")
  if (!validSession(json)) throw new Error("Resposta de sessão inválida.")
  return json as AuthSessionResponse
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const offline = typeof window === "undefined" ? null : carregarSessaoOffline<AuthSessionResponse>()?.dados ?? null
  const { data, error, isLoading, mutate } = useSWR<AuthSessionResponse>("/api/auth/me", fetchLiveSession, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
  })

  useEffect(() => {
    if (!data) return
    if (data.sessao) salvarSessaoOffline(data)
    else limparDadosPrivadosOffline()
  }, [data])

  const value = useMemo<AuthSessionContextValue>(() => {
    const liveSession = data?.sessao ?? null
    const ready = !isLoading
    const sessao = data ? liveSession : error ? offline?.sessao ?? null : null
    return {
      ready,
      liveAuthenticated: Boolean(liveSession),
      liveSession,
      sessao,
      refresh: mutate,
    }
  }, [data, error, isLoading, mutate, offline])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext)
  if (!value) throw new Error("useAuthSession deve ser usado dentro de AuthSessionProvider")
  return value
}
