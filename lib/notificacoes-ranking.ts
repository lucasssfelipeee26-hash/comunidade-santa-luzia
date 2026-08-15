import { calcularRanking } from "@/lib/ranking"
import { salvarNotificacao } from "@/lib/notificacoes"

type Posicao = { posicao: number; nome: string; pontos: number }
export type SnapshotRanking = Map<string, Posicao>

export function snapshotRanking(ano: number): SnapshotRanking {
  return new Map(calcularRanking(ano).ranking.map((r) => [r.usuarioId, { posicao: r.posicao, nome: r.nome, pontos: r.pontos }]))
}

export function notificarMudancasRanking(ano: number, antes: SnapshotRanking, autorId: string, origem: string) {
  const depoisLista = calcularRanking(ano).ranking
  const depois = new Map(depoisLista.map((r) => [r.usuarioId, { posicao: r.posicao, nome: r.nome, pontos: r.pontos }]))
  const autorAntes = antes.get(autorId)
  const autorDepois = depois.get(autorId)
  const momento = Date.now()

  if (autorDepois && autorAntes && autorDepois.posicao < autorAntes.posicao) {
    salvarNotificacao({
      usuario_id: autorId,
      chave: `ranking-subiu:${origem}:${autorAntes.posicao}:${autorDepois.posicao}:${momento}`,
      tipo: "ranking",
      titulo: "Você subiu na classificação!",
      mensagem: `Agora você está em ${autorDepois.posicao}º lugar com ${autorDepois.pontos} pontos.`,
      href: "/area-restrita/ranking?aba=classificacao",
    })
  }

  for (const [usuarioId, posAntes] of antes) {
    if (usuarioId === autorId) continue
    const posDepois = depois.get(usuarioId)
    if (!posDepois || posDepois.posicao <= posAntes.posicao) continue
    // Notifica somente quem foi ultrapassado pelo participante que acabou de pontuar.
    if (autorAntes && autorDepois && autorAntes.posicao > posAntes.posicao && autorDepois.posicao < posDepois.posicao) {
      salvarNotificacao({
        usuario_id: usuarioId,
        chave: `ranking-ultrapassado:${origem}:${autorId}:${posAntes.posicao}:${posDepois.posicao}:${momento}`,
        tipo: "ranking",
        titulo: "Mudança na classificação",
        mensagem: `${autorDepois.nome} passou você no ranking. Você está agora em ${posDepois.posicao}º lugar.`,
        href: "/area-restrita/ranking?aba=classificacao",
      })
    }
  }
}
