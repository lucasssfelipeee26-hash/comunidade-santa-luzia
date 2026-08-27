# Santa Luzia Android Nativo — Contrato de Migração

A Beta 18 (`2.0.0-beta.18`, code `20018`) é a referência funcional e visual da migração. A versão Kotlin/Jetpack Compose **não pode remover, simplificar ou alterar silenciosamente** funcionalidades já aprovadas.

## Regra de ouro

A migração é paralela. A base WebView/Capacitor continua existindo somente como referência até que o aplicativo nativo tenha paridade auditada. O corte para Kotlin só acontece depois de todos os itens abaixo passarem em testes unitários, integração, UI e aparelho físico.

## Tecnologias finais

- Android: Kotlin 2.4.10 + Jetpack Compose.
- UI: Compose Material 3; sem HTML/CSS/JavaScript na interface final.
- Navegação: Navigation Compose.
- Persistência local: Room/SQLite + DataStore.
- Sincronização: WorkManager + coroutines/Flow, local-first.
- Rede: cliente HTTP Kotlin, com servidor apenas como sincronizador/autenticação/origem de dados novos.
- Auditoria nativa: Kotlin + AndroidX JankStats/StrictMode/FrameMetrics + verificações próprias do Santa Luzia.
- Backend final: Python. O backend atual continua disponível durante a migração para garantir continuidade e será substituído endpoint por endpoint somente após teste de paridade.
- GlitchTip/Sentry externo: removido da arquitetura final.

## Paridade funcional obrigatória

### Sessão e acesso
- Login online.
- Sessão salva para abertura offline após primeiro login válido.
- Logout com confirmação Sim/Não.
- Cadastro e recuperação de senha.
- Perfis de membro e moderador.
- Bloqueio/promoção/status respeitados após sincronização.

### Home pública
- Banner principal limpo, sem botões sobre a imagem.
- Exatamente 4 cards públicos: Centro Litúrgico, Escala do Dia, Biblioteca e Liturgia Diária.
- Cada card possui **um único ícone moderno**, sem ícone legado duplicado.
- Não pode existir quinto card extra de Liturgia.
- Acesso público e autenticado preservado.

### Navegação
- Barra inferior persistente online e offline.
- Início nunca substituído por Perfil.
- Ícones com as animações aprovadas/originais reconstruídas em Compose.
- Transições suaves e sem herdar scroll/estado visual da tela anterior.
- Menu de três barras sem duplicar Liturgia/Escala/Biblioteca/Painel.
- Administração de dados no menu do moderador, nunca no dashboard principal.

### Perfis da equipe
- Faixa horizontal de avatares no estilo Status.
- Deslize horizontal fluido.
- Busca por nome.
- Modal/tela de perfil proporcional.
- X para fechar.
- Foto preservando proporção.
- Nome, função, desde, recado/bio, classificação, pontos e aproveitamento.
- Cache offline.

### Escalas
- Próximas escalas.
- Escala do dia.
- Histórico sem lista infinita: recentes visíveis; antigas pesquisáveis.
- Pesquisa por data.
- Pesquisa por tempo litúrgico.
- Publicação/edição/exclusão por moderador.
- Funções litúrgicas e validações preservadas.
- Justificativa de ausência.
- Operações locais entram em fila e sincronizam depois.

### Formação e presença
- Lista e materiais.
- Presença pessoal conforme horário/regra existente.
- Controle de presenças do moderador.
- Histórico.
- Anexos essenciais disponíveis offline depois de sincronizados.

### Atrasos
- Qualquer membro pode relatar colega atrasado.
- Relatado e moderador veem o relato.
- Só moderador confirma/rejeita.
- Funciona local-first e sincroniza.

### Ranking, quiz e jogos
- Ranking completo e cache offline.
- Pontuação dos jogos contabilizada.
- Quiz litúrgico/manual.
- Constância de Luz.
- Joias/Caminho da Luz.
- Whatajong local/offline enquanto fizer parte da versão aprovada.
- Animações aprovadas de pódio/troféu/perfil reconstruídas em Compose.

### Liturgia e biblioteca
- Liturgia diária 2026 completa, 365 dias, disponível 100% offline.
- Acervo iLiturgia empacotado/local conforme versão aprovada.
- Biblioteca com cache/offline.
- Centro Litúrgico.

### Administração e registros
- Administração de dados no menu.
- Exclusão de cadastro com confirmação.
- Reset do placar com confirmação.
- Registros, faltas, justificativas e advertências.
- Promoção/status de membros.
- Tema/configurações administrativas que já existem.

### Notificações e sincronização
- Notificações locais.
- Recepção de dados novos quando houver rede.
- Fila offline idempotente.
- Replay ordenado ao reconectar.
- O app deve continuar navegável e funcional sem conexão.

### Auditor Santa Luzia nativo
- Interface simplificada para o usuário: indicadores + Executar auditoria + Gerar relatório + Compartilhar + Limpar histórico.
- Sem painel gigante de eventos recentes.
- Erros contados por assinatura única; ocorrências repetidas incrementam `occurrences`.
- Varredura de navegação, banco, fila, rede, ícones, elementos cortados, jank/FPS, ANR/StrictMode e falhas de sincronização.
- Relatório JSON nativo compartilhável.
- Nenhuma dependência obrigatória de GlitchTip/Sentry.

## Critérios de bloqueio de release

A build nativa deve falhar se:
1. qualquer item do contrato estiver ausente da matriz de paridade;
2. Home tiver quantidade diferente de 4 cards;
3. houver mais de um ícone por card;
4. barra inferior desaparecer em estado offline simulado;
5. algum destino principal não existir;
6. banco local não abrir/integrity check falhar;
7. fila não sobreviver a reinício;
8. Liturgia offline não cobrir 365 dias de 2026;
9. Auditor inflar erros repetidos;
10. código de interface depender de WebView/HTML/CSS/JavaScript.

## Processo de implementação

Cada fatia segue: **implementar -> teste unitário -> teste de integração -> teste Compose UI -> auditoria de paridade -> só então próxima fatia**.

A versão final só substitui a Beta 18 depois da auditoria completa e teste em aparelho físico.
