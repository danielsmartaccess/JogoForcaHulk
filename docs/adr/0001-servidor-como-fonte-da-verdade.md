# ADR 0001: O servidor é a fonte da verdade

- **Status:** Aceita (registro retroativo, a confirmar)
- **Data:** 2026-10-21 (decisão tomada com o backend Supabase, 2026-10-15)

## Contexto

O jogo original rodava inteiro no navegador, com progresso no `localStorage` e ranking simulado. Com ranking global e recompensas, o placar passa a importar, e qualquer lógica no cliente pode ser alterada por quem controla o navegador. O cabeçalho da migration inicial resume o princípio: o navegador nunca recebe a palavra antes do fim da partida e não grava pontuação diretamente.

## Decisão

Toda regra que sorteia a palavra, valida a letra e altera pontuação, conquistas e recompensas roda no banco, em funções `SECURITY DEFINER` (`iniciar_partida`, `tentar_letra`). A palavra secreta só chega ao navegador quando a partida termina. O cliente só altera preferências (nome, dificuldade, categoria, Plus), e o placar é protegido por grants de coluna e RLS.

## Alternativas consideradas

- Manter a lógica no cliente e aceitar a pontuação enviada por ele: descartada porque abriria brecha para trapaça (registrado no README, nas limitações do modo local).

## Consequências

- O cliente só consegue o que as seis RPCs permitem; a segurança depende das políticas e grants ([SECURITY.md](../SECURITY.md)).
- A interface fica ligada ao contrato das RPCs, inclusive aos códigos de erro ([ARCHITECTURE.md](../ARCHITECTURE.md)).
- O modo local precisa replicar as regras ([ADR 0003](0003-front-end-estatico-com-modo-local.md)).
- Mudar uma regra exige migration nova e testes SQL.
