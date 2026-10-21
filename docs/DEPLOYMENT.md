# Deploy

## Visão geral

| Componente | Destino | Gatilho | Workflow |
|---|---|---|---|
| Site estático (`index.html`, `style.css`, `script.js`, `config.js`, `servico-supabase.js`) | GitHub Pages | push na `main` que altere um desses arquivos ou o próprio workflow; ou execução manual | `.github/workflows/publicar-site.yml` |
| Banco (migrations em `supabase/migrations/`) | Supabase, projeto `dmcxzxkmxdhmufltlkel` (sa-east-1, plano Pro) | push na `main` que altere `supabase/migrations/**`; ou execução manual | `.github/workflows/migrations-supabase.yml` |

O site não tem build. O workflow copia os cinco arquivos para `_site/`, roda `node --check` em cada `.js` e publica. Nada de `supabase/`, testes ou documentação vai ao ar.

O workflow de migrations usa o Supabase CLI `2.121.0` (fixado), vincula o projeto, mostra o que será aplicado (`db push --dry-run`) e então aplica (`db push`). Um erro no `--dry-run` evita um push parcial.

Configuração única do site: **Settings → Pages → Source: GitHub Actions**.

## Fluxo de mudança

1. Branch `feat/…`, `fix/…` ou `docs/…` a partir da `main`.
2. Se mexeu em migrations ou na lógica do jogo, rode as três camadas de [TESTING.md](TESTING.md) localmente. O CI não faz isso por você.
3. Pull request e merge na `main` (o histórico usa merge commit com o número do PR).
4. Os workflows publicam o site e/ou aplicam as migrations.
5. Confira a execução em **Actions** e abra o site publicado.

Nomes dos arquivos em `supabase/migrations/` precisam bater com as versões já registradas no remoto. **Nunca edite uma migration já aplicada**: crie uma nova.

## Secrets e credenciais

| Nome | Onde | Para quê |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | GitHub → Settings → Secrets and variables → Actions | Vincular o projeto no workflow de migrations. Gerado em https://supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | idem | Aplicar as migrations. Project Settings → Database |

Nenhum dos dois vai ao frontend. O que pode ficar no frontend é só a URL do projeto e a chave **publishable** (`config.js`). Nunca coloque no navegador, no repositório ou em conversas: secret key / `service_role`, senha do banco ou token de acesso.

**Rotacionar as credenciais** (faça no seu terminal, sem colar valores em chats):

1. Gere um token novo em https://supabase.com/dashboard/account/tokens e apague o antigo.
2. Redefina a senha do banco em Project Settings → Database.
3. `gh secret set SUPABASE_ACCESS_TOKEN --repo danielsmartaccess/JogoForcaHulk` e `gh secret set SUPABASE_DB_PASSWORD --repo danielsmartaccess/JogoForcaHulk` (o `gh` pede o valor de forma oculta).
4. `gh secret list --repo danielsmartaccess/JogoForcaHulk` para conferir a data.
5. Rode manualmente o workflow "Migrations Supabase" e confirme que termina com sucesso.

## Configuração manual no Supabase (Dashboard)

Estas opções **não** estão no repositório (o `config.toml` só vale para o ambiente local). Reconfira-as ao criar um projeto novo ou ao suspeitar de mudança.

| Configuração esperada | Onde | Última verificação |
|---|---|---|
| Provider **Email** ligado e **Confirm email** ligado | Authentication → Sign In / Providers | 2026-10-19, pelo endpoint público `/auth/v1/settings` |
| **Allow anonymous sign-ins** desligado (o jogo não usa e as RPCs recusam anônimos) | idem | 2026-10-19, pelo mesmo endpoint |
| Site URL = a URL pública do jogo (hoje `https://danielsmartaccess.github.io/JogoForcaHulk/`) e a mesma URL em Redirect URLs (sem isso o link do e-mail aponta para `localhost`). Quando o jogo passar a usar a URL própria do projeto, troque as duas aqui e acrescente a nova em `additional_redirect_urls` do `config.toml`; o `emailRedirectTo` do cadastro usa o endereço da página, então não muda no código. | Authentication → URL Configuration | não verificável por API; confirmar no Dashboard |
| Tamanho mínimo de senha alinhado à interface (8 caracteres) | Authentication → Sign In / Providers | não verificada |
| **Leaked password protection** ativada (recurso do plano Pro) | Authentication → Attack Protection | verificar no Dashboard |
| SMTP próprio configurado (o servidor padrão tem limite baixo e é só para testes; **obrigatório antes de abrir ao público**) | Authentication → Emails → SMTP Settings | não verificável por API |
| Modelo do e-mail "Confirm signup" em português (opcional) | Authentication → Emails | — |

**CAPTCHA:** o projeto decidiu **não** usar. O frontend não envia token de CAPTCHA; se o CAPTCHA for ligado no Dashboard, o código de cadastro e login precisaria ser alterado.

## Rollback

- **Site:** reverta o commit na `main` (`git revert`) e faça o merge; o workflow republica a versão anterior.
- **Banco:** as migrations não têm "down". Corrija com uma **nova migration** (correção para frente). Para dano grave aos dados, ver backup e restauração em [RUNBOOK.md](RUNBOOK.md).

## Lacunas conhecidas

- O CI não roda os testes (dependem de Docker). A única barreira antes de produção é o `--dry-run`.
- A `main` aceita push direto; a prática atual é por PR, sem regra automática.
