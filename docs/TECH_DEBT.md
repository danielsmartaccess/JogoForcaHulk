# Dívida técnica

Pendências conhecidas, com evidência e proposta. Prioridade: **P1** resolver antes de abrir o jogo ao público · **P2** melhora importante · **P3** opcional no estágio atual. Ao resolver um item, remova-o daqui (o histórico fica no git). Itens de produto ainda não especificados estão em [REQUIREMENTS.md](REQUIREMENTS.md), seção 7.

| ID | Item | Evidência | Impacto | Proposta | Prio |
|---|---|---|---|---|---|
| TD-01 | O CI não roda os testes; as migrations vão a produção após apenas `db push --dry-run` | `.github/workflows/migrations-supabase.yml` | Uma migration defeituosa chega à produção sem teste automático | Job que sobe o Supabase local no runner e executa as três camadas de [TESTING.md](TESTING.md) antes do `db push` | P1 |
| TD-02 | Sem recuperação de senha | README (limitações); [ADR 0002](adr/0002-autenticacao-por-email-e-senha.md) | Jogador que esquece a senha perde o acesso ao progresso | Fluxo "esqueci minha senha" (Auth `resetPasswordForEmail`) e tela de nova senha | P1 |
| TD-03 | Sem aviso de privacidade, termos, exclusão de conta pelo jogador nem canal do titular | [DATA_PRIVACY.md](DATA_PRIVACY.md) | Exposição legal no lançamento público | Itens de "Antes de abrir ao público" em DATA_PRIVACY | P1 |
| TD-04 | Contas anônimas legadas ainda existem no projeto remoto | REQUIREMENTS D-09; [RUNBOOK.md](RUNBOOK.md) | Perfis inativos podem aparecer no ranking | Remover pelo procedimento do RUNBOOK | P1 |
| TD-05 | O backup nunca teve a restauração exercitada; a retenção do plano não está confirmada | [RUNBOOK.md](RUNBOOK.md) | Recuperação de desastre incerta | Confirmar retenção e PITR no Dashboard e testar uma restauração num projeto de teste | P2 |
| TD-06 | Regras duplicadas entre o servidor e o modo local (pontuação, conquistas, recompensas, catálogo de palavras e categorias) | `tentar_letra` × `aplicarFimDePartidaLocal`; [ADR 0003](adr/0003-front-end-estatico-com-modo-local.md) | Deriva silenciosa; o banco de palavras local já diverge do servidor | Teste de paridade das fórmulas; não refatorar enquanto o modo local existir | P2 |
| TD-07 | Sem SRI nem CSP para o script do CDN | `index.html` | Risco de cadeia de suprimentos numa página que recebe senhas | Adicionar `integrity` + `crossorigin` ao script, ou copiar o `supabase-js` para o repositório; avaliar CSP por `<meta>` | P2 |
| TD-08 | Nomes de exibição públicos sem moderação | [SECURITY.md](SECURITY.md), [DATA_PRIVACY.md](DATA_PRIVACY.md) | Conteúdo ofensivo no ranking | Filtro de palavras na criação do perfil e canal de denúncia | P2 |
| TD-09 | Observabilidade mínima: erros só no console do navegador, sem telemetria | `registrarErro` em `script.js` | Falhas em produção passam despercebidas | Definir o que medir (respeitando a LGPD) e como alertar | P2 |
| TD-10 | `main` sem proteção de branch | configuração do GitHub | Push direto na `main` dispara deploy em produção | Exigir pull request e checks na `main` | P2 |
| TD-11 | Acessibilidade sem auditoria; o modal não prende o foco | [REQUIREMENTS.md](REQUIREMENTS.md) NFR-08 | Barreira para parte do público | Auditoria WCAG e correção do modal | P2 |
| TD-12 | Navegadores suportados e metas de desempenho e disponibilidade não definidos | REQUIREMENTS NFR-07 e NFR-09 | Sem critério de aceitação não funcional | Definir com o responsável | P2 |
| TD-13 | Sair da partida não a encerra no servidor, e a sequência de letras persiste em partidas abandonadas | REQUIREMENTS D-05, D-06 | Estatística de "jogando agora" inflada; efeito sutil na "melhor sequência" | Decidir a regra de abandono (por exemplo, encerrar por tempo) | P3 |
| TD-14 | `script.js` concentra catálogo, autenticação, motores e interface (cerca de 1,2 mil linhas) | `script.js` | Custo de manutenção crescente | Só dividir se o projeto crescer (YAGNI) | P3 |
| TD-15 | Escrita de presença a cada 2 minutos por aba (`obter_perfil` faz `update`) | `INTERVALO_PRESENCA_MS` | Carga de escrita proporcional aos jogadores online | Reavaliar quando o volume crescer | P3 |
| TD-16 | Sem lint, formatador nem `package.json`; os testes dependem de `npm install --no-save` | raiz do repositório | Estilo e dependências de teste sem controle | Acrescentar só se houver mais de um contribuidor | P3 |
| TD-17 | `config.toml` aponta para `seed.sql`, que não existe (aviso no `db reset`) | `supabase/config.toml` | Ruído | Limpar `sql_paths` | P3 |
| TD-18 | `project_id` ainda contém "broce" (define o nome dos containers do teste) | `supabase/config.toml` | Nome desatualizado | Renomear junto com os comandos de teste | P3 |
| TD-19 | Comentários `RF…` no `e2e.mjs` usam IDs antigos | [TESTING.md](TESTING.md) | Rastreabilidade confusa | Trocar pelos IDs atuais (só comentários) | P3 |
| TD-20 | O contador de conquistas no HTML nasce como "0 / 6" (o catálogo tem 7) | REQUIREMENTS D-08 | Cosmético | Corrigir o texto inicial | P3 |
