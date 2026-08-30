# Backend Python — Santa Luzia

Backend FastAPI que substitui endpoint por endpoint o servidor TypeScript/Next.js usado como sincronizador do aplicativo Santa Luzia.

## Estado comprovado no CI

O workflow `.github/workflows/python-backend.yml` bloqueia regressões com:

- comparação automática de todas as combinações método/rota em `app/api/**/route.ts` contra o FastAPI;
- paridade semântica crítica da Liturgia offline e do Ofício/I Vésperas;
- regras de negócio de autenticação, migração de usuários, ranking e edição de escalas;
- uploads multipart reais de material de formação e acervo litúrgico;
- smoke tests dos endpoints públicos centrais;
- proteção, integridade e backup do banco local do servidor.

A auditoria endpoint a endpoint cobre atualmente **67/67 combinações método/rota**.

## Execução local

```bash
python -m pip install -r python-backend/requirements.txt
PYTHONPATH=python-backend AUTH_SECRET='troque-por-um-segredo-forte' \
  uvicorn santa_luzia_backend.main:app --host 0.0.0.0 --port 8000
```

Healthcheck: `GET /health`.

## Persistência

O servidor grava dados mutáveis em `DATA_DIR`. Em produção, mantenha esse diretório em volume persistente. No Railway/Docker, o caminho esperado é:

```text
/app/data
```

Não faça cutover sem uma cópia íntegra do volume do backend atual e um ensaio de restauração.

## Variáveis de produção

Obrigatórias:

- `AUTH_SECRET`: segredo longo e exclusivo de produção;
- `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD`: bootstrap apenas quando necessário. A senha deve ter pelo menos 10 caracteres.

Recomendadas/necessárias conforme recurso:

- `INITIAL_ADMIN_NAME`
- `INITIAL_ADMIN_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT` (padrão 587)
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ANDROID_APK_AVAILABLE`
- `ANDROID_LATEST_VERSION_CODE`
- `ANDROID_LATEST_VERSION_NAME`
- `ANDROID_APK_URL`
- `ANDROID_UPDATE_REQUIRED`
- `ANDROID_UPDATE_HIGHLIGHTS`
- `DATA_DIR=/app/data`

## Deploy paralelo no Railway

O `railway.json` da raiz continua apontando para o servidor Next.js atual de propósito. Ele **não deve ser trocado antes do cutover**.

Para criar um serviço Python paralelo no mesmo projeto Railway:

1. crie um novo serviço a partir deste mesmo repositório/branch;
2. configure o arquivo de Config as Code como `/python-backend/railway.json`;
3. monte um volume persistente em `/app/data`;
4. configure as variáveis acima;
5. gere um domínio separado para homologação;
6. valide `GET /health` e execute a bateria de regressão do app nativo contra esse domínio;
7. só depois planeje a troca de endpoint de sincronização.

O arquivo `python-backend/railway.json` usa `python-backend/Dockerfile` e healthcheck `/health`. A produção Next existente fica intacta durante toda a homologação.

## Android nativo e seleção de backend

A build Kotlin/Compose usa a produção atual por padrão, mas aceita um sincronizador alternativo sem alteração de código:

```bash
SANTA_LUZIA_SYNC_BASE_URL='https://seu-backend-python.up.railway.app' \
  gradle -p native-android :app:assembleDebug
```

A URL deve usar HTTPS. Isso permite testar o Python em paralelo sem redirecionar os aparelhos atuais.

## Gate de cutover

O Python pode ser considerado implementado em código quando todos os testes de CI estão verdes. Isso **não equivale a produção liberada**. O corte fica bloqueado até, no mínimo:

- serviço Python paralelo saudável com volume persistente;
- cópia + restauração testada dos dados reais;
- login/cadastro/recuperação de senha testados no serviço paralelo;
- SMTP de produção testado;
- sincronização online/offline testada no APK nativo contra o Python;
- uploads e downloads reais testados no ambiente Railway;
- atualização Android verificada sem quebrar dispositivos existentes;
- auditoria em aparelho físico;
- plano de rollback para o serviço Next.js anterior.
