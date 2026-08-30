from __future__ import annotations

from fastapi.testclient import TestClient

from santa_luzia_backend.main import app
from santa_luzia_backend.routers import archive, formations


def _ci_moderator(_request):
    return {
        "id": "ci-moderator-upload",
        "nome": "CI Moderador",
        "tipo": "moderador",
        "status": "aprovado",
        "funcao": "Acólito",
    }


def main():
    # As funções de rota resolvem estes nomes no módulo em tempo de execução.
    # O objetivo deste script é isolar multipart/storage, não repetir a auditoria
    # de autenticação, que possui testes próprios nas rotas de autenticação.
    formations.require_moderator = _ci_moderator
    formations.require_user = _ci_moderator
    archive.require_moderator = _ci_moderator

    client = TestClient(app)

    created = client.post(
        "/api/formacoes",
        data={
            "titulo": "Formação de auditoria multipart",
            "tema": "Upload local-first",
            "data": "2026-12-31",
            "horario": "18:30",
            "descricao": "Registro temporário criado pelo CI para validar upload e download.",
            "status": "agendada",
            "clientRequestId": "ci-upload-multipart-001",
        },
        files={"arquivo": ("material-ci.txt", b"conteudo multipart santa luzia", "text/plain")},
    )
    assert created.status_code == 201, created.text
    formation = created.json().get("formacao") or {}
    formation_id = str(formation.get("id") or "")
    attachment = formation.get("arquivo") or {}
    assert formation_id, created.json()
    assert attachment.get("nome_original") == "material-ci.txt", created.json()
    assert attachment.get("tamanho") == len(b"conteudo multipart santa luzia"), created.json()

    downloaded = client.get(f"/api/formacoes/{formation_id}/download")
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == b"conteudo multipart santa luzia", downloaded.content

    deleted = client.delete(f"/api/formacoes/{formation_id}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json().get("ok") is True, deleted.json()

    # Se request.form() voltar a ser comparado com fastapi.UploadFile, este caso
    # cairá incorretamente em "Selecione o pacote". Com a classe do Starlette,
    # o arquivo é reconhecido e avança até a validação da extensão.
    archive_probe = client.post(
        "/api/admin/acervo-liturgico",
        files={"arquivo": ("probe.txt", b"nao-e-um-tar", "text/plain")},
    )
    assert archive_probe.status_code == 400, archive_probe.text
    assert archive_probe.json().get("erro") == "O arquivo deve estar no formato .tar.", archive_probe.json()

    print("Uploads multipart reais: OK")


if __name__ == "__main__":
    main()
