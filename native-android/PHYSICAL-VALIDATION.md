# Validação física — Beta 19 nativa

Este gate só pode ser concluído em aparelho Android real. O objetivo é impedir que uma validação de emulador seja confundida com homologação física final.

## APK a validar

- Application ID: `br.com.comunidadesantaluzia.nativebeta`
- Versão esperada: `3.0.0-native-beta.19-r2`
- Version code esperado: `30020`
- O SHA-256 do APK testado deve ser registrado na evidência.

## Roteiro mínimo obrigatório

1. Instalar o APK em aparelho físico sem substituir o aplicativo oficial.
2. Confirmar abertura a frio sem crash e sem tela branca.
3. Validar Home pública, menu e Login.
4. Validar sessão de Membro: Início, Escala, Formação e Quiz.
5. Validar sessão de Moderador e menu administrativo.
6. Desligar a rede e validar conteúdo/local-first, navegação e operações previstas para offline.
7. Criar ao menos uma alteração que entre na fila offline; religar a rede e confirmar replay sem duplicação.
8. Reiniciar o aplicativo e confirmar sessão/cache persistentes e isolamento por conta.
9. Executar o Auditor Santa Luzia e confirmar integridade SQLite `ok` e ausência de erro fatal novo.
10. Guardar identificação do aparelho, Android, SHA do commit, SHA-256 do APK, horário e resultado dos checks.

## Evidência final

Somente após todos os itens acima passarem deve ser criado `native-android/release-evidence/physical-validation.json`, no formato abaixo:

```json
{
  "gate": "physical.validation",
  "result": "passed",
  "checkedAt": "AAAA-MM-DDTHH:MM:SSZ",
  "commit": "SHA_DO_COMMIT_TESTADO",
  "apkSha256": "SHA256_DO_APK",
  "device": "fabricante/modelo",
  "android": "versão",
  "checks": [
    {"name": "cold-start", "passed": true},
    {"name": "member-flow", "passed": true},
    {"name": "moderator-flow", "passed": true},
    {"name": "offline-online-replay", "passed": true},
    {"name": "restart-persistence", "passed": true},
    {"name": "native-auditor", "passed": true}
  ]
}
```

Não alterar `physical.validation` para `implemented` nem `releaseAllowed` para `true` antes dessa evidência existir e corresponder exatamente ao APK/commit homologado.
