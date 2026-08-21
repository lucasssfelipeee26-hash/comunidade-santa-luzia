"use client"

import { useEffect, useRef, useState } from "react"
import { Crown, TrendingUp, X } from "lucide-react"

type RankingLinha = {
  posicao: number
  usuarioId: string
  nome: string
  funcao?: string | null
  foto?: string | null
  pontos: number
}

type RankingResposta = {
  eu?: { id: string; nome: string }
  ranking?: RankingLinha[]
}

type Snapshot = {
  euId: string
  linhas: RankingLinha[]
}

type EventoRanking = {
  chave: string
  titulo: string
  descricao: string
  linha: RankingLinha
  lider?: RankingLinha
}

const SNAPSHOT_KEY = "santa-luzia:ranking-motion:snapshot-v1"
const TEMPO_BANNER = 5_800

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

function podiumVisivel() {
  const titulos = Array.from(document.querySelectorAll("h1,h2,h3,p"))
  const titulo = titulos.find((el) => (el.textContent || "").includes("Pódio da equipe"))
  if (!titulo) return false
  const secao = titulo.closest("section")
  if (!secao) return false
  const rect = secao.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight
}

function lerSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const valor = JSON.parse(raw) as Snapshot
    if (!valor || typeof valor.euId !== "string" || !Array.isArray(valor.linhas)) return null
    return valor
  } catch {
    return null
  }
}

function salvarSnapshot(snapshot: Snapshot) {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)) } catch {}
}

function encontrarEvento(anterior: Snapshot, atual: Snapshot): EventoRanking | null {
  if (!anterior.linhas.length || !atual.linhas.length) return null

  const antigos = new Map(anterior.linhas.map((linha) => [linha.usuarioId, linha]))
  const atualEu = atual.linhas.find((linha) => linha.usuarioId === atual.euId)
  const antigoEu = anterior.linhas.find((linha) => linha.usuarioId === anterior.euId)

  if (antigoEu && atualEu && atualEu.posicao > antigoEu.posicao) {
    const ultrapassou = atual.linhas
      .filter((linha) => linha.usuarioId !== atual.euId)
      .map((linha) => ({ atual: linha, antigo: antigos.get(linha.usuarioId) }))
      .filter(({ atual: linhaAtual, antigo }) => Boolean(
        antigo
        && antigo.posicao > antigoEu.posicao
        && linhaAtual.posicao < atualEu.posicao,
      ))
      .sort((a, b) => a.atual.posicao - b.atual.posicao)[0]

    if (ultrapassou) {
      return {
        chave: `passou-voce:${ultrapassou.atual.usuarioId}:${ultrapassou.atual.posicao}:${ultrapassou.atual.pontos}`,
        titulo: `${ultrapassou.atual.nome} passou você`,
        descricao: `Agora está em ${ultrapassou.atual.posicao}º lugar com ${ultrapassou.atual.pontos} pontos.`,
        linha: ultrapassou.atual,
        lider: atual.linhas[0],
      }
    }
  }

  const liderAntes = anterior.linhas[0]
  const liderAgora = atual.linhas[0]
  if (liderAntes && liderAgora && liderAntes.usuarioId !== liderAgora.usuarioId) {
    return {
      chave: `lider:${liderAgora.usuarioId}:${liderAgora.pontos}`,
      titulo: `${liderAgora.nome} assumiu o 1º lugar!`,
      descricao: `Novo líder da Jornada com ${liderAgora.pontos} pontos.`,
      linha: liderAgora,
      lider: liderAgora,
    }
  }

  const entrouTop3 = atual.linhas
    .filter((linha) => linha.posicao <= 3)
    .map((linha) => ({ atual: linha, antigo: antigos.get(linha.usuarioId) }))
    .filter(({ atual: linhaAtual, antigo }) => Boolean(antigo && antigo.posicao > 3 && linhaAtual.posicao <= 3))
    .sort((a, b) => a.atual.posicao - b.atual.posicao)[0]

  if (entrouTop3) {
    return {
      chave: `top3:${entrouTop3.atual.usuarioId}:${entrouTop3.atual.posicao}:${entrouTop3.atual.pontos}`,
      titulo: `${entrouTop3.atual.nome} entrou no Top 3`,
      descricao: `Subiu para o ${entrouTop3.atual.posicao}º lugar com ${entrouTop3.atual.pontos} pontos.`,
      linha: entrouTop3.atual,
      lider: liderAgora,
    }
  }

  return null
}

function classeMetal(posicao: number) {
  if (posicao === 1) return "ranking-motion-gold"
  if (posicao === 2) return "ranking-motion-silver"
  if (posicao === 3) return "ranking-motion-bronze"
  return "ranking-motion-default"
}

export function RankingMotionRuntime() {
  const [evento, setEvento] = useState<EventoRanking | null>(null)
  const fechadorRef = useRef<number | null>(null)
  const consultaRef = useRef(false)
  const ultimaChaveRef = useRef("")

  useEffect(() => {
    let encerrado = false

    const fecharDepois = () => {
      if (fechadorRef.current != null) window.clearTimeout(fechadorRef.current)
      fechadorRef.current = window.setTimeout(() => setEvento(null), TEMPO_BANNER)
    }

    const consultar = async () => {
      if (encerrado || consultaRef.current || !navigator.onLine) return
      consultaRef.current = true
      try {
        const response = await fetch(`/api/ranking?motion=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        })
        if (!response.ok) return
        const json = await response.json() as RankingResposta
        if (!json.eu?.id || !Array.isArray(json.ranking)) return

        const atual: Snapshot = {
          euId: json.eu.id,
          linhas: json.ranking.map((linha) => ({
            posicao: Number(linha.posicao),
            usuarioId: String(linha.usuarioId),
            nome: String(linha.nome),
            funcao: linha.funcao || null,
            foto: linha.foto || null,
            pontos: Number(linha.pontos) || 0,
          })),
        }
        const anterior = lerSnapshot()
        salvarSnapshot(atual)

        if (!anterior || anterior.euId !== atual.euId || !podiumVisivel()) return
        const novoEvento = encontrarEvento(anterior, atual)
        if (!novoEvento || novoEvento.chave === ultimaChaveRef.current) return

        ultimaChaveRef.current = novoEvento.chave
        setEvento(novoEvento)
        fecharDepois()
      } catch {
        // Sem banner quando o aparelho está offline; o próximo sync tentará novamente.
      } finally {
        consultaRef.current = false
      }
    }

    const agendar = () => window.setTimeout(() => void consultar(), 180)
    const aoVisibilidade = () => { if (document.visibilityState === "visible") agendar() }

    const inicial = window.setTimeout(() => void consultar(), 650)
    window.addEventListener("santa-luzia:server-sync", agendar)
    window.addEventListener("santa-luzia:manual-sync", agendar)
    document.addEventListener("visibilitychange", aoVisibilidade)

    return () => {
      encerrado = true
      window.clearTimeout(inicial)
      if (fechadorRef.current != null) window.clearTimeout(fechadorRef.current)
      window.removeEventListener("santa-luzia:server-sync", agendar)
      window.removeEventListener("santa-luzia:manual-sync", agendar)
      document.removeEventListener("visibilitychange", aoVisibilidade)
    }
  }, [])

  if (!evento) return null

  const metal = classeMetal(evento.linha.posicao)
  return (
    <aside className={`ranking-motion-banner ${metal}`} role="status" aria-live="polite" data-no-pull-refresh>
      <button type="button" className="ranking-motion-close" aria-label="Fechar aviso do ranking" onClick={() => setEvento(null)}><X className="size-4" /></button>
      <div className="ranking-motion-avatar-wrap" aria-hidden="true">
        <div className="ranking-motion-avatar">
          {evento.linha.foto ? <img src={evento.linha.foto} alt="" /> : <span>{iniciais(evento.linha.nome)}</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] opacity-75">
          {evento.linha.posicao === 1 ? <Crown className="size-3" /> : <TrendingUp className="size-3" />}
          Movimento no ranking
        </div>
        <p className="mt-0.5 truncate font-serif text-sm font-bold">{evento.titulo}</p>
        <p className="mt-0.5 text-[10px] leading-4 opacity-80">{evento.descricao}</p>
        {evento.lider && evento.lider.usuarioId !== evento.linha.usuarioId && (
          <p className="mt-1 truncate text-[9px] font-semibold opacity-65">Líder: {evento.lider.nome} · {evento.lider.pontos} pts</p>
        )}
      </div>
      <div className="ranking-motion-rank" aria-label={`${evento.linha.posicao}º lugar`}>
        <strong>{evento.linha.posicao}º</strong>
        <span>{evento.linha.pontos} pts</span>
      </div>
      <style>{`
        .ranking-motion-banner {
          --rank-metal: #8c6a78;
          --rank-glow: rgba(113,48,68,.24);
          position: fixed;
          left: 12px;
          right: 12px;
          top: max(calc(env(safe-area-inset-top) + 12px), 18px);
          z-index: 125;
          display: flex;
          align-items: center;
          gap: 11px;
          max-width: 470px;
          margin: 0 auto;
          padding: 11px 38px 11px 11px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--rank-metal) 72%, white);
          border-radius: 22px;
          color: #3e3034;
          background: rgba(255,253,249,.97);
          box-shadow: 0 14px 40px var(--rank-glow), 0 2px 9px rgba(37,22,26,.09);
          backdrop-filter: blur(18px);
          animation: rankingMotionBannerIn 480ms cubic-bezier(.18,.88,.2,1.08) both;
        }
        .ranking-motion-banner::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(105deg, transparent 28%, color-mix(in srgb, var(--rank-metal) 20%, white) 48%, transparent 68%);
          transform: translateX(-115%);
          animation: rankingMotionSweep 1100ms ease 360ms both;
        }
        .ranking-motion-gold { --rank-metal:#d0a11e; --rank-glow:rgba(204,153,21,.28); }
        .ranking-motion-silver { --rank-metal:#aab2bf; --rank-glow:rgba(119,132,151,.22); }
        .ranking-motion-bronze { --rank-metal:#b36d3d; --rank-glow:rgba(174,99,52,.23); }
        .ranking-motion-default { --rank-metal:#7b3048; --rank-glow:rgba(113,48,68,.21); }
        .ranking-motion-avatar-wrap {
          position: relative;
          display: grid;
          place-items: center;
          flex: 0 0 48px;
          width: 48px;
          height: 48px;
          border-radius: 999px;
          background: conic-gradient(from 20deg, var(--rank-metal), white, var(--rank-metal), transparent 72%, var(--rank-metal));
          box-shadow: 0 0 16px var(--rank-glow);
          animation: rankingMotionRing 3.2s linear infinite;
        }
        .ranking-motion-avatar {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          overflow: hidden;
          border: 2px solid white;
          border-radius: 999px;
          background: #f2e9e6;
          color: #713044;
          font-size: 10px;
          font-weight: 900;
          transform-style: preserve-3d;
          animation: rankingMotionAvatarTurn 1120ms cubic-bezier(.18,.78,.2,1) both;
        }
        .ranking-motion-avatar img { width:100%; height:100%; object-fit:cover; }
        .ranking-motion-rank {
          position: relative;
          z-index: 1;
          flex: 0 0 auto;
          min-width: 48px;
          padding: 5px 7px;
          border-radius: 13px;
          text-align: center;
          background: color-mix(in srgb, var(--rank-metal) 11%, white);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rank-metal) 25%, white);
        }
        .ranking-motion-rank strong { display:block; color:var(--rank-metal); font-size:14px; line-height:1; }
        .ranking-motion-rank span { display:block; margin-top:3px; color:#75676b; font-size:8px; font-weight:800; white-space:nowrap; }
        .ranking-motion-close {
          position:absolute;
          right:7px;
          top:7px;
          z-index:2;
          display:grid;
          place-items:center;
          width:27px;
          height:27px;
          border-radius:999px;
          color:#7a6b70;
          background:rgba(255,255,255,.72);
        }
        @keyframes rankingMotionBannerIn { from{opacity:0;transform:translateY(-18px) scale(.96)} to{opacity:1;transform:none} }
        @keyframes rankingMotionSweep { to{transform:translateX(115%)} }
        @keyframes rankingMotionRing { to{transform:rotate(360deg)} }
        @keyframes rankingMotionAvatarTurn {
          0%{transform:perspective(480px) rotateY(-205deg) scale(.84);opacity:.25}
          58%{transform:perspective(480px) rotateY(17deg) scale(1.045);opacity:1}
          80%{transform:perspective(480px) rotateY(-6deg) scale(1.01)}
          100%{transform:perspective(480px) rotateY(0deg) scale(1);opacity:1}
        }
        @media (min-width: 520px) { .ranking-motion-banner { left:50%; right:auto; width:min(470px,calc(100vw - 32px)); transform:translateX(-50%); } @keyframes rankingMotionBannerIn { from{opacity:0;transform:translate(-50%,-18px) scale(.96)} to{opacity:1;transform:translate(-50%,0) scale(1)} } }
        @media (prefers-reduced-motion: reduce) { .ranking-motion-banner, .ranking-motion-banner::before, .ranking-motion-avatar-wrap, .ranking-motion-avatar { animation:none !important; } }
      `}</style>
    </aside>
  )
}
