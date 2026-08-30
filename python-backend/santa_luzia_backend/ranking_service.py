from __future__ import annotations

from typing import Any

from .store import approved_team, ranking_config, read_main


def calculate_ranking(year: int, store: dict[str, Any] | None = None) -> dict[str, Any]:
    source = store or read_main()
    prefix = f"liturgia-auto:{year}-"
    answers = [
        row for row in source["quiz_respostas"]
        if isinstance(row, dict) and str(row.get("quiz_id") or "").startswith(prefix)
    ]
    adjustments = [
        row for row in source["ranking_ajustes"]
        if isinstance(row, dict) and int(row.get("ano") or 0) == int(year)
    ]
    rows: list[dict[str, Any]] = []
    for user in approved_team(source):
        mine = [row for row in answers if str(row.get("usuario_id")) == str(user.get("id"))]
        liturgy_points = sum(int(row.get("pontos") or 0) for row in mine)
        possible = sum(int(row.get("total_pontos") or 0) for row in mine)
        hits = sum(int(row.get("acertos") or 0) for row in mine)
        adjustment_points = sum(
            int(row.get("pontos") or 0)
            for row in adjustments
            if str(row.get("usuario_id")) == str(user.get("id"))
        )
        rows.append(
            {
                "posicao": 0,
                "usuarioId": user.get("id"),
                "nome": user.get("nome"),
                "funcao": user.get("funcao"),
                "foto": user.get("foto"),
                "pontos": liturgy_points + adjustment_points,
                "acertos": hits,
                "quizzesRespondidos": len(mine),
                "aproveitamento": round((liturgy_points / possible) * 100) if possible > 0 else 0,
                "formacao": 0,
                "liturgia": liturgy_points,
                "pontualidade": 0,
                "reconhecimento": 0,
                "ajustes": adjustment_points,
                "reconhecimentos": 0,
                "atrasosConfirmados": 0,
                "escalasNoAno": 0,
            }
        )
    rows.sort(key=lambda row: (-int(row["pontos"]), -int(row["acertos"]), str(row["nome"]).casefold()))
    for index, row in enumerate(rows, start=1):
        row["posicao"] = index
    return {"config": ranking_config(year, source), "ranking": rows}
