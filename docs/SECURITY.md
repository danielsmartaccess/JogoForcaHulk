# Segurança

Modelo de segurança do Forca Gama, derivado das migrations (`supabase/migrations/`), do frontend e da configuração. Para a configuração manual do Dashboard, ver [DEPLOYMENT.md](DEPLOYMENT.md).

## Princípios

1. **O servidor é a fonte da verdade.** O navegador é não confiável: ele nunca recebe a palavra secreta antes do fim da partida e nunca grava pontuação. Toda regra que altera o placar roda em funções `SECURITY DEFINER`.
2. **A chave publishable é pública por desenho.** Ela vai no `config.js`; a proteção real são as políticas RLS, os grants e as funções.
3. **Privilégio mínimo.** As tabelas partem de `revoke all` para `anon` e `authenticated`; só o necessário é liberado.
4. **Sem sessão paralela.** A sessão pertence ao `supabase-js`; a aplicação não guarda senha, e-mail nem token no `localStorage` por conta própria.

## Controle de acesso (por tabela)

| Tabela | `anon` | `authenticated` |
|---|---|---|
| `dificuldades`, `categorias`, `conquistas`, `recompensas` | leitura | leitura |
| `palavras` | nada | nada (RLS ligada e sem política: só as funções leem) |
| `jogadores` | nada | lê **o próprio** perfil; altera só `nome`, `dificuldade`, `categoria`, `is_plus` do próprio; sem INSERT nem DELETE |
| `partidas` | nada | lê **as próprias**, sem as colunas `palavra`, `palavra_id` e `letras_corretas`; sem escrita |
| `jogador_conquistas`, `jogador_recompensas` | nada | lê as próprias; sem escrita |

## Funções

- Seis RPCs públicas, executáveis só por `authenticated`: `garantir_perfil`, `obter_perfil`, `iniciar_partida`, `tentar_letra`, `obter_ranking`, `obter_estatisticas`. As quatro de jogo (`garantir_perfil`, `obter_perfil`, `iniciar_partida`, `tentar_letra`) começam por `interno.exigir_usuario()`, que recusa quem não tem sessão e as contas anônimas. `obter_ranking` e `obter_estatisticas` são só de leitura e não chamam essa função: dependem do `EXECUTE` restrito ao papel `authenticated`, que inclui contas anônimas caso o login anônimo seja religado.
- Todas as funções definem `set search_path = ''`.
- O schema `interno` está fechado para `anon` e `authenticated`; `nome_de_exibicao` e `criar_jogador_no_cadastro` também têm o `EXECUTE` revogado.
- O Supabase Advisor aponta as seis RPCs como "executáveis por usuários logados" e `palavras` como "RLS sem política". **Ambos são intencionais** e não devem ser "corrigidos".
- `obter_ranking` expõe apenas nome de exibição, pontos, nível, posição e "é você", e só a usuários autenticados. O nome é escolhido pelo próprio jogador e hoje não há moderação.

## Autenticação

- Supabase Auth com e-mail e senha, confirmação de e-mail exigida e login anônimo desligado.
- O perfil é criado por trigger (`criar_jogador_no_cadastro`), que nunca bloqueia um cadastro: se falhar, o perfil nasce no primeiro login por `garantir_perfil()`.
- Senha de 8 a 72 caracteres (72 é o limite do bcrypt). Não há recuperação de senha nem login social ainda.
- Logout encerra só o dispositivo atual (`scope: 'local'`). Sessão inválida ou expirada leva ao login e limpa os dados em memória.
- As mensagens de erro não revelam se um e-mail existe, e o aviso após o cadastro é o mesmo para e-mail novo ou já cadastrado.

## Validação de entradas

A validação do cliente existe para a experiência do usuário; a **autoridade é o servidor**: letra `^[A-Z]$`, nome de 1 a 24 caracteres, palavras `^[A-Z]{2,30}$`, dificuldade e categoria por chave estrangeira.

No frontend, nome, e-mail e dados vindos do servidor entram na página por `textContent`. As ocorrências de `innerHTML` usam apenas dados estáticos, números ou nomes do catálogo. **Regra:** nunca usar `innerHTML` com texto digitado por um usuário.

## Segredos

| Pode ficar no frontend | Nunca no frontend nem no repositório |
|---|---|
| URL do projeto, chave **publishable** | secret key / `service_role`, senha do banco, `SUPABASE_ACCESS_TOKEN` |

- `.env` e `.env.*` estão no `.gitignore` (só `.env.example` é versionado); o `.env.example` traz apenas valores de exemplo e do ambiente local.
- Os secrets do deploy ficam no GitHub Actions. Rotação: ver [DEPLOYMENT.md](DEPLOYMENT.md).
- O repositório é **público**: não registre nele valores de segredos, nem o estado de credenciais ou de pendências de segurança em commits, issues ou documentos.
- Uma varredura do histórico do git (2026-10-19) por padrões de chave secreta, JWT, token de acesso e URL de banco com senha não encontrou ocorrências. Não é garantia absoluta.

## Endurecimentos planejados

- Sem **SRI** (`integrity`) no script do `supabase-js` carregado do jsDelivr (a versão está fixada em `2.117.2`) e sem **CSP**.
- Moderação ou filtro de nomes de exibição no ranking.
- Recuperação de senha.
- Execução automática dos testes antes de aplicar migrations em produção.

## Como reportar uma vulnerabilidade

Canal de reporte: *a definir (requer decisão do responsável)*.
