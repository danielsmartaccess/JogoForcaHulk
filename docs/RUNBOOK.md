# Runbook de operação

Tarefas recorrentes de quem opera o Forca Gama. Projeto Supabase: `dmcxzxkmxdhmufltlkel`. Execute o SQL em **Dashboard → SQL Editor** (papel `postgres`). Para deploy e configuração do Dashboard, ver [DEPLOYMENT.md](DEPLOYMENT.md).

> Regra: antes de qualquer `delete`/`update` em massa, rode o `select` equivalente e confira as linhas.

## Quem está cadastrado

Rode `supabase/consultas/jogadores_cadastrados.sql` (resumo, lista de jogadores, ranking, contas sem perfil e atividade por categoria). Atenção: os comentários do cabeçalho desse arquivo ainda descrevem o modelo anônimo anterior e estão desatualizados; os dados retornados são os atuais.

## Adicionar palavras (sem deploy do site)

```sql
insert into public.palavras (dificuldade, categoria, palavra) values ('medio', 'geral', 'EXEMPLO');
```

Use só letras A–Z maiúsculas, sem acento, de 2 a 30 caracteres (a tabela rejeita o resto). A dificuldade e a categoria precisam existir. Para desativar: `update public.palavras set ativa = false where palavra = 'X';`.

O banco de palavras do modo local fica no `script.js` e não recebe essas palavras.

## Nova categoria

1. Insira em `public.categorias` (slug, nome, ícone, descrição, ordem).
2. Adicione a mesma entrada em `CATEGORIAS` no `script.js` (e, se quiser no modo local, em `BANCO_DE_PALAVRAS`).
3. Insira as palavras (item anterior) para cada dificuldade em que ela deve aparecer.
4. Se isso for uma migration, siga o fluxo de [DEPLOYMENT.md](DEPLOYMENT.md).

## Alterar uma regra de pontuação, conquista ou recompensa

1. Crie uma **nova migration** que substitua `public.tentar_letra` (ou os dados de `conquistas`/`recompensas`). Nunca edite uma migration antiga.
2. Altere o equivalente no modo local: `aplicarFimDePartidaLocal` e `verificarConquistasERecompensas` em `script.js`.
3. Atualize [REQUIREMENTS.md](REQUIREMENTS.md) (RN-09 a RN-12) e os testes SQL.
4. Rode as três camadas de [TESTING.md](TESTING.md).

## Apagar uma conta (LGPD)

**Dashboard → Authentication → Users** → excluir o usuário. O perfil, as partidas, as conquistas e as recompensas são removidos em cascata, e a pessoa sai do ranking. A exclusão não tem desfazer (só pelo backup, ver abaixo).

## Remover contas anônimas

Contas anônimas só existem de antes da autenticação por e-mail (o login anônimo está desligado) e não conseguem jogar. Para listar:

```sql
select u.id, u.created_at, j.nome, j.pontuacao, j.partidas_jogadas
from auth.users u left join public.jogadores j on j.id = u.id
where u.is_anonymous;
```

Para remover (em cascata, irreversível), depois de conferir a lista:

```sql
delete from auth.users where is_anonymous is true and email is null;
```

## Backup e recuperação

- O projeto está em plano **Pro**, que inclui backups diários gerenciados pelo Supabase. A retenção e a disponibilidade de recuperação pontual (PITR) **precisam ser confirmadas** em Dashboard → Database → Backups; este documento não as afirma.
- Restaurar um backup substitui o banco inteiro (inclusive o progresso dos jogadores feito depois do backup). Use só para dano grave aos dados.
- O procedimento de restauração **nunca foi exercitado**. Registre aqui a data do primeiro teste.
- O catálogo (palavras, categorias, conquistas, recompensas) pode ser recriado reaplicando as migrations; o progresso dos jogadores só existe no banco.

## Diagnóstico

- **Dashboard → Logs** (Auth, API, Postgres) para erros do servidor.
- **Dashboard → Advisors** (segurança e desempenho): rode depois de qualquer migration que mude tabelas ou permissões.
- **Actions** no GitHub para falhas de deploy.
- No navegador, o jogo registra erros só no console (`[contexto] nome código status mensagem`), nunca e-mail, senha ou token. Não há telemetria.

## Rotação de credenciais

Ver "Rotacionar as credenciais" em [DEPLOYMENT.md](DEPLOYMENT.md).
