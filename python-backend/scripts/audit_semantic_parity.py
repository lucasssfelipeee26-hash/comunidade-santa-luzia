from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from santa_luzia_backend.liturgy_service import complete_offline_liturgy, local_liturgy
from santa_luzia_backend.main import app
from santa_luzia_backend.office_service import (
    common_document,
    common_for,
    first_vespers_key,
    hour_from_proper,
    proper_exceptions,
    proper_key,
    temporal_document,
)


def assert_liturgy_fallback():
    # Só 12/08 existe em content/liturgia/dias. 30/08 precisa obrigatoriamente do
    # pacote mensal public/offline/liturgia-completa/2026-08.json.
    day = complete_offline_liturgy("2026-08-30")
    assert day is not None, "Pacote mensal não resolveu 2026-08-30"
    assert day.get("liturgia"), day
    readings = day.get("leituras") or {}
    assert readings.get("primeiraLeitura"), "Primeira Leitura ausente no fallback mensal"
    assert readings.get("evangelho"), "Evangelho ausente no fallback mensal"
    resolved = local_liturgy("2026-08-30")
    assert resolved is not None and resolved.get("liturgia") == day.get("liturgia")


def assert_office_helpers():
    assert hour_from_proper("oficio/proprio/oficiodasleituras/santaclara.htm") == "leituras"
    assert hour_from_proper("oficio/proprio/horas/santaclara_vesperas.htm") == "vesperas"
    assert proper_key("oficio/proprio/horas/santaclara_vesperas.htm") == "santaclara"
    assert proper_exceptions("catedra", "terca") == ["oficio/proprio/horas/catedra_comum_terca.htm"]
    assert common_for("santaclara") == "virgens"
    assert common_document("virgens", "vesperas", True) == "oficio/outros/comum_virgens_Ivesperas.htm"
    assert first_vespers_key(date(2026, 8, 15)) == "assuncao"
    path = temporal_document(date(2026, 8, 30), "laudes")
    assert path.startswith("oficio/") and path.endswith("_laudes.htm"), path


def assert_office_endpoint():
    client = TestClient(app)
    # Em 14/08 à tarde, a consulta das Vésperas deve preferir as I Vésperas da
    # Assunção de 15/08 antes do próprio solicitado para 14/08.
    first = client.get(
        "/api/acervo-documento",
        params={
            "categoria": "oficio",
            "documento": "oficio/proprio/horas/saomaximiliano_vesperas.htm",
            "data": "2026-08-14",
        },
    )
    assert first.status_code == 200, first.text
    first_path = str(first.json().get("path") or first.json().get("id") or "").lower()
    assert "assuncao" in first_path and "ivesperas" in first_path, first.json()

    # Um próprio inexistente e sem comum conhecido deve cair no temporal da hora,
    # exatamente como o route.ts original.
    temporal = client.get(
        "/api/acervo-documento",
        params={
            "categoria": "oficio",
            "documento": "oficio/proprio/horas/chaveinexistente_laudes.htm",
            "data": "2026-08-30",
        },
    )
    assert temporal.status_code == 200, temporal.text
    expected = temporal_document(date(2026, 8, 30), "laudes").lower()
    actual = str(temporal.json().get("path") or temporal.json().get("id") or "").replace("\\", "/").lower()
    assert actual == expected or actual.endswith(expected.split("/")[-1]), (actual, expected)


def main():
    assert_liturgy_fallback()
    print("Semântica da Liturgia offline: OK")
    assert_office_helpers()
    print("Calendário/comuns do Ofício: OK")
    assert_office_endpoint()
    print("Fallbacks do endpoint de Ofício: OK")
    print("Paridade semântica crítica: OK")


if __name__ == "__main__":
    main()
