-- ============================================================================
-- Testes das regras do jogo e da segurança (RLS/grants).
-- Rodar contra um banco com as migrations aplicadas:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/regras_do_jogo.sql
-- Tudo roda dentro de uma transação desfeita no final (não deixa lixo).
-- ============================================================================
begin;

create or replace function pg_temp.checar(condicao boolean, descricao text) returns void
language plpgsql as $$
begin
  if not condicao then raise exception 'FALHOU: %', descricao; end if;
  raise notice 'ok - %', descricao;
end;
$$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- Palavra controlada para tornar o teste determinístico.
insert into public.palavras (dificuldade, categoria, palavra) values ('dificil', 'geral', 'ZZTESTE');
update public.palavras set ativa = false where dificuldade = 'dificil' and categoria = 'geral' and palavra <> 'ZZTESTE';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select pg_temp.checar((public.registrar_jogador('Dani') ->> 'nome') = 'Dani', 'registrar_jogador cria perfil');
select pg_temp.checar((public.obter_estatisticas() -> 'palavras' -> 'facil' ->> 'geral')::int = 6, 'estatisticas expõem contagem de palavras');

create temp table t_partida as select public.iniciar_partida('dificil', 'geral') as r;
select pg_temp.checar((select (r ->> 'tamanho')::int = 7 from t_partida), 'iniciar_partida devolve só o tamanho');
select pg_temp.checar((select not (r ? 'palavra') from t_partida), 'palavra secreta não vaza no início');

create temp table t_jogada as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'z') as r;
select pg_temp.checar((select (r ->> 'acertou')::boolean and r -> 'posicoes' = '[0,1]'::jsonb from t_jogada), 'acerto devolve posições (base 0)');
select pg_temp.checar((select r -> 'palavra' = 'null'::jsonb from t_jogada), 'palavra continua oculta durante a partida');

select pg_temp.checar((public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'Z') ->> 'repetida')::boolean, 'letra repetida é ignorada');
select pg_temp.checar((public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'X') ->> 'erros')::int = 1, 'erro incrementa contador');
select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), l) from unnest(array['T', 'E']) l;
create temp table t_fim as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'S') as r;

-- Difícil: 150 + 4 letras distintas × 5 = 170 pontos; cognitivo 14 + 4 + 5 = 23.
select pg_temp.checar((select r ->> 'status' = 'vitoria' and r ->> 'palavra' = 'ZZTESTE' from t_fim), 'vitória revela a palavra');
select pg_temp.checar((select (r ->> 'pontos')::int = 170 and (r ->> 'pontos_cognitivos')::int = 23 from t_fim), 'pontuação igual à regra local');
select pg_temp.checar((select (r -> 'jogador' ->> 'vitorias_dificil')::int = 1 and (r -> 'jogador' ->> 'melhor_sequencia_letras')::int = 3 from t_fim), 'estatísticas do jogador atualizadas');
select pg_temp.checar((select r -> 'jogador' -> 'conquistas' @> '["primeiro-acerto","primeira-vitoria","desafio-dificil"]'::jsonb from t_fim), 'conquistas desbloqueadas');
select pg_temp.checar((select jsonb_array_length(r -> 'jogador' -> 'recompensas') = 0 from t_fim), 'nenhuma recompensa com 1 vitória (meta mínima no Difícil = 2)');

-- Segurança: placar e palavras não são acessíveis diretamente.
do $$ begin
  update public.jogadores set pontuacao = 999999;
  raise exception 'FALHOU: cliente conseguiu alterar a pontuação';
exception when insufficient_privilege then raise notice 'ok - cliente não altera pontuação';
end $$;
do $$ begin
  perform * from public.palavras;
  raise exception 'FALHOU: cliente leu a tabela de palavras';
exception when insufficient_privilege then raise notice 'ok - tabela de palavras protegida';
end $$;
do $$ begin
  perform * from public.partidas;
  raise exception 'FALHOU: cliente leu a tabela de partidas';
exception when insufficient_privilege then raise notice 'ok - tabela de partidas protegida';
end $$;
update public.jogadores set is_plus = true, categoria = 'tecnologia';
select pg_temp.checar((select is_plus from public.jogadores), 'preferências próprias atualizáveis');

-- Isolamento entre jogadores (RLS).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select pg_temp.checar((select count(*) from public.jogadores) = 0, 'jogador B não vê perfil de A');
update public.jogadores set nome = 'hack';
select public.registrar_jogador('Bia');
do $$ begin
  perform public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'A');
  raise exception 'FALHOU: jogador B jogou na partida de A';
exception when no_data_found then raise notice 'ok - jogador B não joga na partida de A';
end $$;
select pg_temp.checar((select count(*) from public.obter_ranking(10)) = 2, 'ranking inclui quem jogou e o próprio jogador');
select pg_temp.checar((select nome from public.obter_ranking(10) where posicao = 1) = 'Dani', 'ranking ordenado por pontos');

-- Derrota: 6 erros → 20% dos pontos.
create temp table t_b as select public.iniciar_partida('dificil', 'geral') as r;
select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_b), l) from unnest(array['A','B','C','D','F']) l;
create temp table t_b_fim as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_b), 'G') as r;
select pg_temp.checar((select r ->> 'status' = 'derrota' and (r ->> 'pontos')::int = 30 from t_b_fim), 'derrota rende 20% dos pontos');
do $$ begin
  perform public.tentar_letra((select (r ->> 'partida_id')::uuid from t_b), 'H');
  raise exception 'FALHOU: jogou em partida encerrada';
exception when invalid_parameter_value then raise notice 'ok - partida encerrada não aceita letras';
end $$;

-- Usuário anônimo da API (sem login) não executa RPCs.
reset role;
set local role anon;
do $$ begin
  perform public.obter_estatisticas();
  raise exception 'FALHOU: anon executou RPC';
exception when insufficient_privilege then raise notice 'ok - role anon sem acesso às RPCs';
end $$;

rollback;
