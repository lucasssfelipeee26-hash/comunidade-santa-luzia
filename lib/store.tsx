"use client"

import { createContext, useCallback, useContext, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { authJson, loginConfirmed, validSession } from "@/lib/auth-client"
import { carregarSessaoOffline, limparDadosPrivadosOffline, salvarSessaoOffline } from "@/lib/offline-data"

export type Registro = {
  id: string
  data: string
  descricao: string
  criadoEm: number
}

export type StatusMembro = "pendente" | "aprovado" | "recusado"

export type Membro = {
  id: string
  nome: string
  usuario: string
  funcao: "Acólito" | "Coroinha"
  email: string
  desde: string
  data_nascimento?: string | null
  data_votos?: string | null
  foto?: string | null
  status: StatusMembro
  advertencias: Registro[]
  justificativas: Registro[]
  faltas: Registro[]
  observacoes: Registro[]
}

export type Sessao = { tipo: "moderador"; nome: string } | { tipo: "membro"; id: string } | null

type UsuarioSessao = {
  id: string
  nome: string
  usuario?: string
  email: string
  funcao: string | null
  desde: string | null
  status: StatusMembro
}

type MeResponse = {
  sessao: null | { tipo: "moderador" | "membro"; usuario: UsuarioSessao }
}

const fetcher = async (url: string) => {
  try {
    const response = url === "/api/auth/me" ? null : await fetch(url, { credentials: "same-origin" })
    if (response && !response.ok) throw new Error(`HTTP ${response.status}`)
    const json = response ? await response.json() : await authJson(url)
    if (url === "/api/auth/me" && !validSession(json)) throw new Error("Resposta de sessão inválida.")
    if (url === "/api/auth/me") {
      if (json?.sessao) salvarSessaoOffline(json)
      else limparDadosPrivadosOffline()
    }
    return json
  } catch (error) {
    if (url === "/api/auth/me") {
      const cache = carregarSessaoOffline<MeResponse>()
      if (cache?.dados?.sessao) return cache.dados
    }
    throw error
  }
}

type ResultadoAcao = { ok: boolean; erro?: string; destino?: string; mensagem?: string }

type Ctx = {
  ready: boolean
  dadosModeradorCarregando: boolean
  membros: Membro[]
  equipe: Membro[]
  sessao: Sessao
  membroAtual: Membro | null
  cadastrar: (dados: {
    nome: string
    usuario: string
    funcao: "Acólito" | "Coroinha"
    email: string
    senha: string
    dataNascimento: string
    dataVotos?: string
  }) => Promise<ResultadoAcao>
  login: (usuario: string, senha: string) => Promise<ResultadoAcao>
  logout: () => Promise<void>
  aprovarMembro: (id: string) => void
  recusarMembro: (id: string) => void
  promoverMembro: (id: string) => Promise<ResultadoAcao>
  adicionarJustificativa: (membroId: string, data: string, descricao: string) => void
  adicionarRegistro: (
    membroId: string,
    tipo: "advertencias" | "faltas" | "observacoes",
    data: string,
    descricao: string,
  ) => void
  removerRegistro: (
    membroId: string,
    tipo: "advertencias" | "faltas" | "observacoes" | "justificativas",
    registroId: string,
  ) => void
  solicitarRecuperacaoSenha: (email: string) => Promise<{ ok: boolean; mensagem?: string; erro?: string }>
  confirmarRecuperacaoSenha: (
    email: string,
    codigo: string,
    novaSenha: string,
  ) => Promise<ResultadoAcao>
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { data: meData, isLoading: meLoading } = useSWR<MeResponse>("/api/auth/me", fetcher)

  const sessaoInfo = meData?.sessao ?? null
  const isModerador = sessaoInfo?.tipo === "moderador"
  const isMembro = sessaoInfo?.tipo === "membro"

  const { data: membrosData, isLoading: membrosLoading } = useSWR<{ membros: Membro[] }>(
    isModerador ? "/api/membros" : null,
    fetcher,
  )
  const { data: equipeData, isLoading: equipeLoading } = useSWR<{ equipe: Membro[] }>(
    isModerador ? "/api/equipe" : null,
    fetcher,
  )
  const { data: membroData } = useSWR<{ membro: Membro }>(
    isMembro ? `/api/membros/${sessaoInfo!.usuario.id}` : null,
    fetcher,
  )

  const ready = !meLoading

  const sessao: Sessao = isModerador
    ? { tipo: "moderador", nome: sessaoInfo!.usuario.nome }
    : isMembro
      ? { tipo: "membro", id: sessaoInfo!.usuario.id }
      : null

  const cadastrar = useCallback<Ctx["cadastrar"]>(async (dados) => {
    const res = await fetch("/api/auth/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    })
    return res.json()
  }, [])

  const login = useCallback<Ctx["login"]>(async (usuario, senha) => {
    const result = await loginConfirmed(usuario, senha)
    if (result.ok) {
      salvarSessaoOffline(result.me)
      await globalMutate("/api/auth/me", result.me, { revalidate: false })
    }
    return result
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    limparDadosPrivadosOffline()
    await globalMutate("/api/auth/me")
  }, [])

  const aprovarMembro = useCallback((id: string) => {
    fetch(`/api/membros/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "aprovado" }),
    }).then(() => Promise.all([globalMutate("/api/membros"), globalMutate("/api/equipe")]))
  }, [])

  const recusarMembro = useCallback((id: string) => {
    fetch(`/api/membros/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "recusado" }),
    }).then(() => Promise.all([globalMutate("/api/membros"), globalMutate("/api/equipe")]))
  }, [])

  const promoverMembro = useCallback<Ctx["promoverMembro"]>(async (id) => {
    try {
      const response = await fetch(`/api/membros/${id}/promover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      })
      const resultado = await response.json().catch(() => ({ ok: false, erro: "Resposta inválida do servidor." })) as ResultadoAcao
      if (response.ok && resultado.ok) {
        await Promise.all([globalMutate("/api/membros"), globalMutate("/api/equipe"), globalMutate("/api/ranking")])
      }
      return resultado
    } catch {
      return { ok: false, erro: "Sem conexão com o servidor. Tente novamente quando estiver online." }
    }
  }, [])

  const adicionarJustificativa = useCallback<Ctx["adicionarJustificativa"]>((membroId, data, descricao) => {
    fetch(`/api/membros/${membroId}/registros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "justificativas", data, descricao }),
    }).then(() => {
      globalMutate(`/api/membros/${membroId}`)
      globalMutate("/api/membros")
    })
  }, [])

  const adicionarRegistro = useCallback<Ctx["adicionarRegistro"]>((membroId, tipo, data, descricao) => {
    fetch(`/api/membros/${membroId}/registros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, data, descricao }),
    }).then(() => {
      globalMutate("/api/membros")
      globalMutate(`/api/membros/${membroId}`)
    })
  }, [])

  const removerRegistro = useCallback<Ctx["removerRegistro"]>((membroId, _tipo, registroId) => {
    fetch(`/api/membros/${membroId}/registros/${registroId}`, { method: "DELETE" }).then(() => {
      globalMutate("/api/membros")
      globalMutate(`/api/membros/${membroId}`)
    })
  }, [])

  const solicitarRecuperacaoSenha = useCallback<Ctx["solicitarRecuperacaoSenha"]>(async (email) => {
    const res = await fetch("/api/auth/recuperar-senha/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    return res.json()
  }, [])

  const confirmarRecuperacaoSenha = useCallback<Ctx["confirmarRecuperacaoSenha"]>(
    async (email, codigo, novaSenha) => {
      const res = await fetch("/api/auth/recuperar-senha/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo, novaSenha }),
      })
      return res.json()
    },
    [],
  )

  const membros = membrosData?.membros ?? []
  const equipe = equipeData?.equipe ?? []
  const membroAtual = membroData?.membro ?? null

  const value = useMemo<Ctx>(
    () => ({
      ready,
      dadosModeradorCarregando: Boolean(isModerador && (membrosLoading || equipeLoading || !membrosData || !equipeData)),
      membros,
      equipe,
      sessao,
      membroAtual,
      cadastrar,
      login,
      logout,
      aprovarMembro,
      recusarMembro,
      promoverMembro,
      adicionarJustificativa,
      adicionarRegistro,
      removerRegistro,
      solicitarRecuperacaoSenha,
      confirmarRecuperacaoSenha,
    }),
    [
      ready,
      isModerador,
      membrosLoading,
      equipeLoading,
      membrosData,
      equipeData,
      membros,
      equipe,
      sessao,
      membroAtual,
      cadastrar,
      login,
      logout,
      aprovarMembro,
      recusarMembro,
      promoverMembro,
      adicionarJustificativa,
      adicionarRegistro,
      removerRegistro,
      solicitarRecuperacaoSenha,
      confirmarRecuperacaoSenha,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider")
  return ctx
}

export function formatarData(iso: string) {
  if (!iso) return ""
  const [ano, mes, dia] = iso.split("-")
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}
