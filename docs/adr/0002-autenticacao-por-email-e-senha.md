# ADR 0002: Autenticação por e-mail e senha, com perfil criado por trigger

- **Status:** Aceita (registro retroativo, a confirmar)
- **Data:** 2026-10-21 (decisão implementada em 2026-10-16)

## Contexto

A primeira versão do backend usava login anônimo do Supabase e pedia só um apelido. Segundo o comentário da migration `autenticacao_email`, contas anônimas não têm e-mail nem recuperação.

## Decisão

Contas reais com e-mail e senha no Supabase Auth, com confirmação de e-mail obrigatória. O perfil (`public.jogadores`) é criado por um trigger em `auth.users` a partir do nome de exibição enviado no cadastro, e `garantir_perfil()` o recria de forma idempotente se faltar. Contas anônimas deixam de poder jogar. A senha e o e-mail ficam somente no Auth.

## Alternativas consideradas

- Manter o login anônimo (abandonada, pelos motivos do contexto).
- Criar o perfil só por RPC depois do login: não funciona antes da confirmação do e-mail, pois ainda não há sessão. O trigger resolve isso e nunca bloqueia um cadastro.

## Consequências

- O progresso acompanha a conta em qualquer dispositivo (o objetivo de negócio inclui a jornada contínua do jogador, ver [REQUIREMENTS.md](../REQUIREMENTS.md)).
- A entrega de e-mails passa a ser crítica: o servidor padrão do Supabase tem limite baixo, então o SMTP próprio é obrigatório antes de abrir ao público ([DEPLOYMENT.md](../DEPLOYMENT.md)).
- Ainda não há recuperação de senha ([TECH_DEBT.md](../TECH_DEBT.md)).
- Contas anônimas da versão anterior ficam sem uso e devem ser removidas ([RUNBOOK.md](../RUNBOOK.md)).
- Há dados pessoais (e-mail) a tratar conforme a LGPD ([DATA_PRIVACY.md](../DATA_PRIVACY.md)).
