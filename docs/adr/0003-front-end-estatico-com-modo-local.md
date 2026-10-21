# ADR 0003: Front-end estático sem build, com modo local de fallback

- **Status:** Aceita (registro retroativo, a confirmar)
- **Data:** 2026-10-21 (decisão herdada do projeto original)

## Contexto

O jogo nasceu como HTML, CSS e JavaScript puros, publicável em qualquer hospedagem estática. O backend foi acrescentado depois e não deveria transformar o jogo em algo que deixa de abrir quando o servidor falha.

## Decisão

Manter o front-end estático, sem bundler nem dependências npm, publicado no GitHub Pages. O `supabase-js` vem de um CDN, com versão fixada. Se a biblioteca não carregar, ou se o servidor estiver fora do ar **e** não houver sessão salva, o jogo roda no motor local original (`motorLocal`), com os dois motores seguindo o mesmo contrato. Com sessão salva e servidor inacessível, a interface oferece "Tentar novamente" em vez de trocar de motor, para não criar um progresso paralelo.

## Alternativas consideradas

- Exigir sempre o servidor, sem modo local: não adotada; os comentários do código mantêm o "motor local original" como fallback.
- Outras alternativas (por exemplo, framework e passo de build) não foram registradas no projeto original. *Requer confirmação do responsável.*

## Consequências

- Deploy simples (cópia de cinco arquivos) e nenhum build a manter.
- Dependência de um CDN, sem SRI hoje ([TECH_DEBT.md](../TECH_DEBT.md)).
- As regras de pontuação, conquistas e recompensas existem em dois lugares (SQL e `script.js`) e precisam ser mantidas iguais, sem teste automático de paridade.
- `script.js` concentra catálogo, autenticação, motores e interface.
- O progresso do modo local nunca vai à nuvem: aceitar pontuação do cliente abriria brecha para trapaça ([ADR 0001](0001-servidor-como-fonte-da-verdade.md)).
