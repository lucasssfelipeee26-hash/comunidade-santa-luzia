# Publicação — Comunidade Santa Luzia

Este pacote está preparado para GitHub + Railway.

## Antes de publicar

- NÃO envie a pasta `data/` ao GitHub. Ela contém cadastros e dados privados.
- Em produção, configure `AUTH_SECRET` e `INITIAL_ADMIN_*` no Railway.
- Monte um Volume do Railway em `/app/data` para preservar cadastros, escalas, formações, tema e uploads.
- Se quiser levar os dados atuais do computador para o site publicado, faça backup da sua pasta `data` antes. Depois ela poderá ser enviada ao Volume do Railway.

## Fluxo

1. Crie um repositório privado no GitHub.
2. Envie todo o conteúdo desta pasta para o repositório.
3. No Railway: New Project > Deploy from GitHub repo.
4. Selecione o repositório.
5. Em Variables, configure as variáveis de `.env.example` obrigatórias.
6. Adicione um Volume com Mount Path `/app/data`.
7. Faça o deploy.
8. Em Settings > Networking, clique em Generate Domain.
9. Defina `NEXT_PUBLIC_SITE_URL` com o endereço gerado e faça Redeploy.
10. Teste página inicial, Liturgia, Biblioteca, Escala, login, cadastro, Formação e painel do moderador.

## Dados persistentes

O código usa `./data`. No Railway, o diretório da aplicação fica em `/app`, por isso o Volume deve ser montado em `/app/data`.

## Atualizações futuras

Teste localmente, faça commit/push no GitHub e o Railway fará um novo deploy. O Volume `/app/data` continua preservado.
