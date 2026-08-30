from __future__ import annotations

from typing import Any

from .ranking_service import calculate_ranking
from .store import read_main, save_notification


def ranking_snapshot(year: int, store: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    source = store or read_main()
    return {
        str(row["usuarioId"]): {"posicao": row["posicao"], "nome": row["nome"], "pontos": row["pontos"]}
        for row in calculate_ranking(year, source)["ranking"]
    }


def notify_ranking_changes(year: int, before: dict[str, dict[str, Any]], author_id: str, origin: str) -> None:
    after = ranking_snapshot(year)
    author_before = before.get(author_id)
    author_after = after.get(author_id)
    if author_before and author_after and int(author_after["posicao"]) < int(author_before["posicao"]):
        save_notification(
            author_id,
            f"ranking-subiu:{origin}:{author_before['posicao']}:{author_after['posicao']}",
            "ranking",
            "Você subiu na classificação!",
            f"Agora você está em {author_after['posicao']}º lugar com {author_after['pontos']} pontos.",
            "/area-restrita/ranking?aba=classificacao",
        )
    for user_id, previous in before.items():
        if user_id == author_id:
            continue
        current = after.get(user_id)
        if not current or int(current["posicao"]) <= int(previous["posicao"]):
            continue
        if author_before and author_after and int(author_before["posicao"]) > int(previous["posicao"]) and int(author_after["posicao"]) < int(current["posicao"]):
            save_notification(
                user_id,
                f"ranking-ultrapassado:{origin}:{author_id}:{previous['posicao']}:{current['posicao']}",
                "ranking",
                "Mudança na classificação",
                f"{author_after['nome']} passou você no ranking. Você está agora em {current['posicao']}º lugar.",
                "/area-restrita/ranking?aba=classificacao",
            )
