# Dados pessoais e privacidade

Inventário **factual** dos dados que o Forca Gama trata, extraído do esquema, do código e da configuração. Este documento **não é** política de privacidade nem parecer jurídico: bases legais, textos para o titular e prazos de retenção dependem de validação jurídica e estão marcados como *requer validação*.

## Papéis

| Papel | Quem | Observação |
|---|---|---|
| Controlador (LGPD) | **Just Go** (informado pelo responsável do produto) | Razão social, CNPJ e endereço: *requer validação* |
| Encarregado (DPO) e canal do titular | *não definidos* | Necessários antes do lançamento público |
| Operador de infraestrutura | Supabase (banco e autenticação, região sa-east-1, São Paulo) | Contrato e cláusulas de tratamento: *requer validação* |
| Hospedagem do site | GitHub Pages | Recebe as requisições HTTP de quem abre o site |
| CDN do `supabase-js` | jsDelivr | Recebe as requisições do script (única dependência externa do site) |
| Envio de e-mails | Servidor padrão do Supabase hoje; SMTP próprio será configurado | O provedor escolhido passará a ser mais um operador |

## Dados tratados

| Dado | Onde fica | Origem | Quem acessa |
|---|---|---|---|
| E-mail | Supabase Auth (`auth.users`) | Cadastro | Só o próprio titular (sessão) e quem opera o projeto. **Nenhuma tabela da aplicação copia o e-mail.** |
| Senha | Supabase Auth, em formato protegido pelo próprio Auth | Cadastro | Ninguém lê a senha em texto |
| Nome de exibição | `auth.users` (metadados) e `public.jogadores.nome` | Cadastro | **Aparece no ranking para os usuários autenticados**; escolhido livremente pelo jogador, sem moderação |
| Progresso (pontos, nível, partidas, vitórias, sequências, conquistas, recompensas, pontos cognitivos lúdicos) | `public.jogadores` e tabelas de progressão | Gerado pelo jogo | O próprio jogador; pontos, nível e nome aparecem no ranking |
| Histórico de partidas (categoria, dificuldade, resultado, pontos, letras tentadas, datas) | `public.partidas` | Gerado pelo jogo | O próprio jogador (sem a palavra secreta) |
| Preferências (dificuldade, categoria, interesse em Plus) | `public.jogadores` | Escolha do jogador | O próprio jogador |
| Presença ("visto em", atualizado a cada 2 minutos com a aba aberta) | `public.jogadores.visto_em` | Automático | Alimenta a contagem agregada de jogadores online |
| Datas de criação e atualização do perfil | `public.jogadores` | Automático | Operação |
| Sessão (tokens) | `localStorage` do navegador (chaves `sb-…`, do `supabase-js`) | Login | O navegador do jogador |
| Perfil do modo local (apelido e progresso) | `localStorage` (`forcaGama.player.v1`) | Modo offline | Fica **só** no navegador; nunca é enviado |
| Dados técnicos de autenticação (por exemplo, endereço IP e agente de usuário) | Supabase Auth, conforme sua própria documentação | Automático | *Requer validação* junto à documentação do Supabase |

O site não define cookies e não usa ferramentas de análise ou telemetria. Não há dados de pagamento (Plus, Oportuni Clube e anúncios são demonstrativos).

## Finalidades (inferidas do funcionamento; confirmar)

Autenticar o jogador, salvar e restaurar o progresso, calcular conquistas e recompensas, exibir ranking e estatísticas agregadas e operar o serviço. Qualquer uso futuro (por exemplo, estatísticas sobre a evolução dos jogadores ou recompensas reais, ver ROAD-02 e ROAD-03 em [REQUIREMENTS.md](REQUIREMENTS.md)) precisa de finalidade e base legal próprias antes de ser implementado.

## Pontos de atenção para a LGPD (requerem validação jurídica)

1. **Base legal** de cada tratamento e **aviso de privacidade** acessível no cadastro: hoje o site não tem aviso de privacidade nem termos de uso.
2. **Idade mínima:** o público inclui jogadores casuais e o jogo não pergunta a idade. O tratamento de dados de crianças e adolescentes tem regras próprias; defina a idade mínima.
3. **Nome público:** o nome de exibição é visível no ranking para quem tem conta. Informe isso ao jogador no cadastro e considere moderação ([TECH_DEBT.md](TECH_DEBT.md)).
4. **Alegações de saúde:** o produto fala em estimular funções cognitivas, qualidade de vida e longevidade. Os "pontos cognitivos" são um indicador **lúdico** e o jogo não mede função cognitiva. Se algum dado passar a ser apresentado ou tratado como informação de saúde, a classificação e os requisitos mudam.
5. **Retenção:** não há prazo definido; os dados ficam até a exclusão da conta.
6. **Transferência a operadores** (Supabase, provedor de SMTP) e eventual transferência internacional.

## Direitos do titular: o que existe hoje

| Direito | Como é atendido hoje | Lacuna |
|---|---|---|
| Acesso e confirmação | O jogador vê seu perfil, progresso e as 5 últimas partidas na interface | Sem exportação completa nem visão do e-mail armazenado |
| Correção | O banco permite alterar o nome, mas a interface não oferece | Sem tela de edição de perfil |
| Eliminação | Manual: o operador exclui o usuário no Dashboard, e o perfil, as partidas e a progressão saem em cascata ([RUNBOOK.md](RUNBOOK.md)) | Sem exclusão pelo próprio jogador; sem canal de solicitação definido |
| Portabilidade | — | Não existe |
| Informação sobre compartilhamento | — | Sem aviso de privacidade |

## Medidas técnicas

Controle de acesso por RLS, ranking sem e-mail, palavra secreta ilegível ao cliente, logs do cliente sem dados pessoais e separação entre chave pública e segredos: ver [SECURITY.md](SECURITY.md).

## Antes de abrir ao público

Definir encarregado e canal do titular; redigir aviso de privacidade e termos de uso (com validação jurídica); definir idade mínima; escolher e documentar o provedor de SMTP; decidir se o jogador poderá excluir a própria conta e corrigir o nome.
