# Comunidade Santa Luzia — Atualização completa no Windows

## Atualizar uma instalação que já está funcionando

1. Pare o servidor com `Ctrl + C`.
2. Não apague a pasta `data`. Ela contém cadastros, registros, escalas, formações e configurações salvas.
3. Extraia o ZIP desta atualização.
4. Copie o conteúdo para a pasta principal do projeto e escolha **Substituir os arquivos no destino**.
5. Limpe apenas o cache do Next.js:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

6. Inicie com:

```powershell
npm run dev
```

O comando `npm run dev` desta versão usa **Webpack**, evitando o erro interno de HMR/Turbopack que ocorreu durante o desenvolvimento.

Abra no próprio computador:

`http://localhost:3000`

Não abra `http://0.0.0.0:3000` no navegador. O endereço `0.0.0.0` serve apenas para o servidor aceitar conexões da rede local.

## Se aparecer “Another next dev server is already running”

Encerre o processo antigo ou execute o arquivo `INICIAR-SITE-CORRIGIDO.bat`, incluído nesta atualização.

## Se o projeto continuar dentro do OneDrive

O OneDrive pode bloquear arquivos `.tsx` enquanto sincroniza. Se voltar a aparecer `os error 32` / “arquivo já está sendo usado por outro processo”, a solução mais estável é mover o projeto para uma pasta fora do OneDrive, por exemplo:

`C:\Projetos\comunidade-santa-luzia`

## Instalação nova

Somente se a pasta `node_modules` não existir, execute uma vez:

```powershell
npm install
```

Depois:

```powershell
npm run dev
```

## Dados que devem ser preservados

Nunca substitua ou apague seus dados reais durante uma atualização:

- `data/santa-luzia.json`
- `data/formacoes/`
- `data/configuracao-site.json`

Este ZIP de atualização não inclui esses arquivos de dados.
