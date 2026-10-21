# ADR 0005: Sem CAPTCHA no cadastro

- **Status:** Aceita
- **Data:** 2026-10-21 (decisão do responsável do produto)

## Contexto

O README original recomendava ativar o CAPTCHA em Authentication → Attack Protection antes de abrir o jogo ao público. O front-end nunca implementou o envio do token de CAPTCHA, então ativar o recurso exigiria alterar o código de cadastro e login.

## Decisão

Não implementar nem recomendar CAPTCHA. A recomendação foi retirada do README.

## Alternativas consideradas

- Implementar o CAPTCHA no front-end: descartada pelo responsável.

## Consequências

- A proteção contra cadastros automatizados fica por conta da confirmação obrigatória de e-mail, dos limites de taxa do Supabase Auth, da proteção contra senhas vazadas (a ativar no Dashboard) e, antes do lançamento, de um SMTP próprio ([DEPLOYMENT.md](../DEPLOYMENT.md)).
- **Não ative o CAPTCHA no Dashboard** sem antes alterar o código de cadastro e login.
- Reavaliar esta decisão se aparecer abuso de cadastros depois do lançamento.
