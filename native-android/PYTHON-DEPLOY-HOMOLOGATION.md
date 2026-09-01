# Homologação do backend Python paralelo

O backend Python só pode fechar o gate final depois de ser implantado em ambiente paralelo, sem substituir automaticamente o serviço Node atual.

## Roteiro mínimo obrigatório

1. Implantar `server-python` em serviço separado com configuração equivalente à homologação.
2. Configurar volume persistente no caminho de dados usado pelo backend.
3. Confirmar `/api/health` saudável e executar a auditoria de paridade das 67 rotas.
4. Validar autenticação, regras de negócio, multipart e operações de leitura/escrita previstas pelo aplicativo.
5. Criar dados de prova, reiniciar/reimplantar o serviço e confirmar que os dados persistem.
6. Testar o rollback para a implantação anterior sem perda dos dados persistentes.
7. Registrar URL do serviço paralelo, commit, implantação, volume, horário e resultado dos checks.

## Evidência final

Somente depois de todos os itens passarem deve ser criado `native-android/release-evidence/python-deploy.json`:

```json
{
  "gate": "backend.pythonDeploy",
  "result": "passed",
  "checkedAt": "AAAA-MM-DDTHH:MM:SSZ",
  "commit": "SHA_DO_COMMIT_IMPLANTADO",
  "service": "serviço paralelo de homologação",
  "deployment": "identificador da implantação",
  "checks": [
    {"name": "health", "passed": true},
    {"name": "route-parity-67-of-67", "passed": true},
    {"name": "business-and-multipart", "passed": true},
    {"name": "persistent-volume-after-restart", "passed": true},
    {"name": "rollback", "passed": true}
  ]
}
```

Não alterar `backend.pythonDeploy` para `implemented` nem liberar a versão final antes dessa evidência existir e corresponder ao commit efetivamente homologado.
