from __future__ import annotations

import os
from copy import deepcopy

from fastapi.testclient import TestClient

from santa_luzia_backend.legacy_migrations import migrate_legacy_users
from santa_luzia_backend.main import app
from santa_luzia_backend.routers import ranking, scales
from santa_luzia_backend.store import find_user_by_login, mutate_main, now_ms, read_main
from santa_luzia_backend.utils import integer_number, operational_year


def _restore(snapshot):
    def restore(data):
        data.clear()
        data.update(deepcopy(snapshot))
    mutate_main(restore)


def _clear_collections():
    def clear(data):
        for key, value in list(data.items()):
            if isinstance(value, list):
                data[key] = []
    mutate_main(clear)


def main():
    snapshot = deepcopy(read_main())
    env_keys = ("INITIAL_ADMIN_USERNAME", "INITIAL_ADMIN_PASSWORD", "INITIAL_ADMIN_NAME", "INITIAL_ADMIN_EMAIL")
    old_env = {key: os.environ.get(key) for key in env_keys}

    try:
        _clear_collections()
        os.environ["INITIAL_ADMIN_USERNAME"] = "ci.moderador"
        os.environ["INITIAL_ADMIN_PASSWORD"] = "ci-senha-segura-123"
        os.environ["INITIAL_ADMIN_NAME"] = "CI Moderador"
        os.environ["INITIAL_ADMIN_EMAIL"] = "ci.moderador@example.invalid"

        client = TestClient(app)
        first_login = client.post(
            "/api/auth/login",
            json={"usuario": "ci.moderador", "senha": "ci-senha-segura-123"},
        )
        assert first_login.status_code == 200, first_login.text
        assert first_login.json()["usuario"]["funcao"] is None, first_login.json()
        bootstrap = find_user_by_login("ci.moderador", read_main())
        assert bootstrap and bootstrap.get("funcao") is None, bootstrap

        # O backend legado aplica esta migração ao iniciar um novo processo.
        assert migrate_legacy_users() is True
        moderator = find_user_by_login("ci.moderador", read_main())
        assert moderator and moderator.get("funcao") == "Acólito", moderator
        assert moderator.get("status") == "aprovado", moderator

        assert operational_year(2026.5) is None
        assert operational_year("2026.5") is None
        assert operational_year("2026.0") == 2026
        assert integer_number(30.5) is None
        assert integer_number("30.0") == 30

        member = {
            "id": "ci-membro-regra",
            "nome": "CI Membro",
            "usuario": "ci.membro.regra",
            "email": "ci.membro.regra@example.invalid",
            "senha_hash": "nao-usada-no-teste",
            "tipo": "membro",
            "funcao": "Coroinha",
            "desde": None,
            "status": "aprovado",
            "criado_em": now_ms(),
        }
        scale = {
            "id": "ci-escala-regra",
            "data": "2026-12-31",
            "horario": "18:00",
            "celebrante": "Padre Teste",
            "pessoas": [],
            "observacoes": "",
            "celebracao_liturgica": None,
            "tempo_liturgico": None,
            "cor_liturgica": None,
            "ciclo_dominical": None,
            "data_liturgica": None,
            "criado_em": now_ms(),
        }

        def seed(data):
            data["usuarios"].append(member)
            data["escalas"].append(scale)
        mutate_main(seed)

        # Isola as regras da rota; autenticação/cookie já foi exercitada acima.
        ranking.require_user = lambda _request: moderator
        scales.require_moderator = lambda _request: moderator

        fractional_points = client.post(
            "/api/ranking",
            json={"action": "ajustar_pontos", "usuarioId": member["id"], "pontos": 1.5, "motivo": "Teste fracionário", "ano": 2026},
        )
        assert fractional_points.status_code == 400, fractional_points.text
        assert fractional_points.json().get("erro") == "Dados inválidos para o ajuste.", fractional_points.json()

        valid_numeric_strings = client.post(
            "/api/ranking",
            json={"action": "ajustar_pontos", "usuarioId": member["id"], "pontos": "1.0", "motivo": "Teste inteiro", "ano": "2026.0"},
        )
        assert valid_numeric_strings.status_code == 200, valid_numeric_strings.text
        assert valid_numeric_strings.json()["ajuste"]["pontos"] == 1, valid_numeric_strings.json()

        fractional_minutes = client.post(
            "/api/ranking",
            json={
                "action": "salvar_config", "ano": 2026,
                "peso_formacao": 25, "peso_liturgia": 25, "peso_pontualidade": 30, "peso_reconhecimento": 20,
                "minutos_antecedencia": 30.5,
            },
        )
        assert fractional_minutes.status_code == 400, fractional_minutes.text

        valid_config = client.post(
            "/api/ranking",
            json={
                "action": "salvar_config", "ano": "2026.0",
                "peso_formacao": 25, "peso_liturgia": 25, "peso_pontualidade": 30, "peso_reconhecimento": 20,
                "minutos_antecedencia": "30.0",
            },
        )
        assert valid_config.status_code == 200, valid_config.text
        assert valid_config.json()["config"]["minutos_antecedencia"] == 30, valid_config.json()

        base_scale_payload = {
            "data": "2026-12-31",
            "horario": "18:00",
            "celebrante": "Padre Teste",
            "observacoes": "",
            "celebracaoLiturgica": "",
            "tempoLiturgico": "",
            "corLiturgica": "",
            "cicloDominical": "",
            "dataLiturgica": "",
        }

        invalid_function = client.patch(
            f"/api/escalas/{scale['id']}",
            json={**base_scale_payload, "pessoas": [{"id": member["id"], "categoria": "coroinha", "funcao": "Função inexistente"}]},
        )
        assert invalid_function.status_code == 400, invalid_function.text
        assert invalid_function.json().get("erro") == "Dados inválidos na escala de CI Membro.", invalid_function.json()

        invalid_category = client.patch(
            f"/api/escalas/{scale['id']}",
            json={**base_scale_payload, "pessoas": [{"id": member["id"], "categoria": "acolito", "funcao": "Cruciferário"}]},
        )
        assert invalid_category.status_code == 400, invalid_category.text
        assert invalid_category.json().get("erro") == "Dados inválidos na escala de CI Membro.", invalid_category.json()

        valid_scale = client.patch(
            f"/api/escalas/{scale['id']}",
            json={**base_scale_payload, "pessoas": [{"id": member["id"], "categoria": "coroinha", "funcao": "Cruciferário"}]},
        )
        assert valid_scale.status_code == 200, valid_scale.text
        people = valid_scale.json()["escala"]["pessoas"]
        assert len(people) == 1 and people[0]["funcao"] == "Cruciferário", valid_scale.json()

        print("Regras de negócio críticas: OK")
    finally:
        _restore(snapshot)
        for key, value in old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


if __name__ == "__main__":
    main()
