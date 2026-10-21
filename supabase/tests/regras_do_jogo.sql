-- ============================================================================
-- Testes das regras do jogo, da autenticação e da segurança (RLS/grants).
-- Rodar contra o Supabase LOCAL (precisa do schema auth real e do papel postgres):
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/regras_do_jogo.sql
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

-- ----------------------------------------------------------------- cadastro
-- Inserir em auth.users dispara o trigger que cria o perfil (é o que o signUp faz).
insert into auth.users (id, aud, role, email, raw_user_meta_data, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@teste.com', '{"display_name":"  Dani   Banner "}', false),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@teste.com', '{"display_name":"Bia"}', false),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'c@teste.com', '{}', false),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'd@teste.com', '{"display_name":"Nome muito mais longo que vinte e quatro caracteres"}', false),
  ('00000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', null, '{"display_name":"Visitante"}', true);

select pg_temp.checar((select nome from public.jogadores where id = '00000000-0000-0000-0000-00000000000a') = 'Dani Banner', 'trigger cria o perfil com o nome de exibição normalizado');
select pg_temp.checar((select nome from public.jogadores where id = '00000000-0000-0000-0000-00000000000c') = 'Jogador', 'sem nome de exibição, o perfil recebe "Jogador"');
select pg_temp.checar((select char_length(nome) <= 24 from public.jogadores where id = '00000000-0000-0000-0000-00000000000d'), 'nome longo é truncado em 24 caracteres');
select pg_temp.checar(not exists (select 1 from public.jogadores where id = '00000000-0000-0000-0000-00000000000e'), 'conta anônima não ganha perfil');
select pg_temp.checar((select count(*) from public.jogadores where id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b')) = 2, 'cada cadastro gera exatamente um perfil');

-- Palavra controlada para tornar o teste determinístico.
insert into public.palavras (dificuldade, categoria, palavra) values ('dificil', 'geral', 'ZZTESTE'), ('medio', 'geral', 'ZZTESTE');
update public.palavras set ativa = false where dificuldade in ('dificil', 'medio') and categoria = 'geral' and palavra <> 'ZZTESTE';

-- ----------------------------------------------------- perfil: recuperação
-- Conta antiga sem perfil (ou trigger que falhou): garantir_perfil recria, sem sobrescrever.
delete from public.jogadores where id = '00000000-0000-0000-0000-00000000000c';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select pg_temp.checar((public.garantir_perfil() ->> 'nome') = 'Jogador', 'garantir_perfil recria o perfil ausente');
update public.jogadores set nome = 'Carol';
select pg_temp.checar((public.garantir_perfil() ->> 'nome') = 'Carol', 'garantir_perfil é idempotente e não sobrescreve o nome');
select pg_temp.checar((select count(*) from public.jogadores) = 1, 'garantir_perfil não duplica o perfil');

-- ------------------------------------------------- identidade obrigatória
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  perform public.obter_perfil();
  raise exception 'FALHOU: RPC executou sem usuário';
exception when invalid_authorization_specification then raise notice 'ok - RPC sem usuário é recusada';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated","is_anonymous":true}', true);
do $$ begin
  perform public.garantir_perfil();
  raise exception 'FALHOU: conta anônima conseguiu usar a RPC';
exception when invalid_authorization_specification then raise notice 'ok - conta anônima é recusada nas RPCs';
end $$;

-- --------------------------------------------------------------- jogo (A)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select pg_temp.checar((public.obter_perfil() ->> 'nome') = 'Dani Banner', 'obter_perfil devolve o perfil do usuário');
select pg_temp.checar((public.obter_perfil() -> 'ultima_partida_em') = 'null'::jsonb, 'sem partidas concluídas, ultima_partida_em é nula');
select pg_temp.checar((public.obter_estatisticas() -> 'palavras' -> 'facil' ->> 'geral')::int = 6, 'estatisticas expõem contagem de palavras');

create temp table t_partida as select public.iniciar_partida('dificil', 'geral') as r;
select pg_temp.checar((select (r ->> 'tamanho')::int = 7 from t_partida), 'iniciar_partida devolve só o tamanho');
select pg_temp.checar((select not (r ? 'palavra') from t_partida), 'palavra secreta não vaza no início');

create temp table t_jogada as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'z') as r;
select pg_temp.checar((select (r ->> 'acertou')::boolean and r -> 'posicoes' = '[0,1]'::jsonb from t_jogada), 'acerto devolve posições (base 0)');
select pg_temp.checar((select r -> 'palavra' = 'null'::jsonb from t_jogada), 'palavra continua oculta durante a partida');

-- Em andamento: o dono lê o histórico, mas nunca a palavra.
select pg_temp.checar((select count(*) from public.partidas where status = 'em_andamento') = 1, 'dono lê a própria partida em andamento (sem a palavra)');
do $$ begin
  perform palavra from public.partidas;
  raise exception 'FALHOU: dono leu a palavra secreta da partida em andamento';
exception when insufficient_privilege then raise notice 'ok - coluna palavra é ilegível, mesmo para o dono';
end $$;
do $$ begin
  perform * from public.partidas;
  raise exception 'FALHOU: select * em partidas foi permitido';
exception when insufficient_privilege then raise notice 'ok - select * em partidas é recusado (palavra fora do grant)';
end $$;

select pg_temp.checar((public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'Z') ->> 'repetida')::boolean, 'letra repetida é ignorada');
select pg_temp.checar((public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'X') ->> 'erros')::int = 1, 'erro incrementa contador');
select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), l) from unnest(array['T', 'E']) l;
create temp table t_fim as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'S') as r;

-- Difícil (x3): (40 + 4 letras distintas × 5) × 3 = 180 pontos; cognitivo 14 + 4 + 5 = 23.
select pg_temp.checar((select r ->> 'status' = 'vitoria' and r ->> 'palavra' = 'ZZTESTE' from t_fim), 'vitória revela a palavra');
select pg_temp.checar((select (r ->> 'pontos')::int = 180 and (r ->> 'pontos_cognitivos')::int = 23 from t_fim), 'pontuação igual à regra local');
select pg_temp.checar((select (r -> 'jogador' ->> 'vitorias_dificil')::int = 1 and (r -> 'jogador' ->> 'melhor_sequencia_letras')::int = 3 from t_fim), 'estatísticas do jogador atualizadas');
select pg_temp.checar((select r -> 'jogador' -> 'conquistas' @> '["primeiro-acerto","primeira-vitoria","desafio-dificil"]'::jsonb from t_fim), 'conquistas desbloqueadas');
select pg_temp.checar((select jsonb_array_length(r -> 'jogador' -> 'recompensas') = 0 from t_fim), 'nenhuma recompensa com 1 vitória (meta mínima no Difícil = 2)');
select pg_temp.checar((select r -> 'jogador' ->> 'ultima_partida_em' is not null from t_fim), 'ultima_partida_em preenchida após concluir');

-- Histórico do dono (colunas permitidas).
select pg_temp.checar((select count(*) = 1 and bool_and(modalidade = 'forca' and status = 'vitoria' and pontos = 180) from public.partidas), 'histórico do dono: 1 partida concluída, modalidade forca');

-- Sem registro duplicado: repetir a jogada final é recusado e nada muda.
do $$ begin
  perform public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'S');
  raise exception 'FALHOU: partida encerrada aceitou nova jogada';
exception when invalid_parameter_value then raise notice 'ok - partida concluída não pode ser registrada de novo';
end $$;
select pg_temp.checar((select vitorias = 1 and partidas_jogadas = 1 and pontuacao = 180 from public.jogadores), 'repetição não duplica vitória nem pontos');

-- ------------------------------------------------ segurança (escrita direta)
do $$ begin
  update public.jogadores set pontuacao = 999999;
  raise exception 'FALHOU: cliente conseguiu alterar a pontuação';
exception when insufficient_privilege then raise notice 'ok - cliente não altera pontuação';
end $$;
do $$ begin
  update public.jogadores set id = '00000000-0000-0000-0000-0000000000ff';
  raise exception 'FALHOU: cliente trocou o dono do perfil';
exception when insufficient_privilege then raise notice 'ok - cliente não altera o identificador do perfil';
end $$;
do $$ begin
  insert into public.jogadores (id, nome) values ('00000000-0000-0000-0000-0000000000ff', 'Fantasma');
  raise exception 'FALHOU: cliente inseriu perfil direto';
exception when insufficient_privilege then raise notice 'ok - cliente não cria perfis direto (só trigger/garantir_perfil)';
end $$;
do $$ begin
  delete from public.jogadores;
  raise exception 'FALHOU: cliente apagou perfil';
exception when insufficient_privilege then raise notice 'ok - cliente não apaga perfil';
end $$;
do $$ begin
  insert into public.partidas (jogador_id, dificuldade, categoria, palavra, status, pontos) values ('00000000-0000-0000-0000-00000000000a', 'facil', 'geral', 'LIVRO', 'vitoria', 9999);
  raise exception 'FALHOU: cliente inseriu partida direto';
exception when insufficient_privilege then raise notice 'ok - cliente não registra partida direto';
end $$;
do $$ begin
  update public.partidas set pontos = 9999;
  raise exception 'FALHOU: cliente alterou partida';
exception when insufficient_privilege then raise notice 'ok - cliente não altera partidas';
end $$;
do $$ begin
  delete from public.partidas;
  raise exception 'FALHOU: cliente apagou partida';
exception when insufficient_privilege then raise notice 'ok - cliente não apaga partidas';
end $$;
do $$ begin
  insert into public.jogador_conquistas (jogador_id, conquista_id) values ('00000000-0000-0000-0000-00000000000a', 'centenario');
  raise exception 'FALHOU: cliente concedeu conquista a si mesmo';
exception when insufficient_privilege then raise notice 'ok - cliente não concede conquistas';
end $$;
do $$ begin
  perform * from public.palavras;
  raise exception 'FALHOU: cliente leu a tabela de palavras';
exception when insufficient_privilege then raise notice 'ok - tabela de palavras protegida';
end $$;
update public.jogadores set is_plus = true, categoria = 'tecnologia';
select pg_temp.checar((select is_plus from public.jogadores), 'preferências próprias atualizáveis');

-- --------------------------------------------------- isolamento entre jogadores (B)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select pg_temp.checar((select count(*) from public.jogadores) = 1 and (select nome from public.jogadores) = 'Bia', 'jogador B só enxerga o próprio perfil');
select pg_temp.checar((select count(*) from public.partidas) = 0, 'jogador B não enxerga partidas de A');
select pg_temp.checar((select count(*) from public.jogador_conquistas) = 0, 'jogador B não enxerga conquistas de A');
select pg_temp.checar((select count(*) from public.jogador_recompensas) = 0, 'jogador B não enxerga recompensas de A');
do $$ declare n integer; begin
  update public.jogadores set nome = 'hack' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.checar(n = 0, 'jogador B não altera o perfil de A (0 linhas afetadas)');
end $$;
do $$ begin
  perform public.tentar_letra((select (r ->> 'partida_id')::uuid from t_partida), 'A');
  raise exception 'FALHOU: jogador B jogou na partida de A';
exception when no_data_found then raise notice 'ok - jogador B não joga na partida de A';
end $$;
-- (independentes do conteúdo do banco: outros jogadores podem existir)
select pg_temp.checar((select count(*) from public.obter_ranking(50) where eh_voce) = 1, 'ranking inclui o próprio jogador, mesmo sem partidas');
select pg_temp.checar((select pontuacao from public.obter_ranking(50) where nome = 'Dani Banner') = 180, 'ranking inclui quem já jogou, com a pontuação correta');
select pg_temp.checar(not exists (select 1 from public.obter_ranking(50) a join public.obter_ranking(50) b on a.posicao < b.posicao where a.pontuacao < b.pontuacao), 'ranking ordenado por pontos');
select pg_temp.checar((select bool_and(not (to_jsonb(r) ? 'email')) from public.obter_ranking(10) r), 'ranking não expõe e-mail');

-- Derrota (Difícil x3): 6 erros → round(20% × 40 × 3) = 24 pontos.
create temp table t_b as select public.iniciar_partida('dificil', 'geral') as r;
select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_b), l) from unnest(array['A','B','C','D','F']) l;
create temp table t_b_fim as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_b), 'G') as r;
select pg_temp.checar((select r ->> 'status' = 'derrota' and (r ->> 'pontos')::int = 24 from t_b_fim), 'derrota rende 20% da base multiplicada pela dificuldade');
do $$ begin
  perform public.tentar_letra((select (r ->> 'partida_id')::uuid from t_b), 'H');
  raise exception 'FALHOU: jogou em partida encerrada';
exception when invalid_parameter_value then raise notice 'ok - partida encerrada não aceita letras';
end $$;

-- Multiplicador: Médio (x2) vence com 4 letras distintas → (40 + 4 × 5) × 2 = 120 pontos.
create temp table t_m as select public.iniciar_partida('medio', 'geral') as r;
select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_m), l) from unnest(array['Z', 'T', 'E']) l;
create temp table t_m_fim as select public.tentar_letra((select (r ->> 'partida_id')::uuid from t_m), 'S') as r;
select pg_temp.checar((select r ->> 'status' = 'vitoria' and (r ->> 'pontos')::int = 120 from t_m_fim), 'o multiplicador escala os pontos da vitória (Médio x2)');

-- Apenas uma partida aberta por jogador: iniciar outra abandona a anterior.
create temp table t_c1 as select public.iniciar_partida('facil', 'geral') as r;
create temp table t_c2 as select public.iniciar_partida('facil', 'geral') as r;
select pg_temp.checar((select count(*) from public.partidas where status = 'em_andamento') = 1 and (select count(*) from public.partidas where status = 'abandonada') = 1, 'só uma partida em andamento por jogador');

-- ----------------------------------------------- requisição sem login (anon)
reset role;
set local role anon;
do $$ begin
  perform public.obter_estatisticas();
  raise exception 'FALHOU: anon executou RPC';
exception when insufficient_privilege then raise notice 'ok - role anon sem acesso às RPCs';
end $$;
do $$ begin
  perform public.garantir_perfil();
  raise exception 'FALHOU: anon executou garantir_perfil';
exception when insufficient_privilege then raise notice 'ok - role anon não chama garantir_perfil';
end $$;
do $$ begin
  perform id from public.partidas;
  raise exception 'FALHOU: anon leu partidas';
exception when insufficient_privilege then raise notice 'ok - role anon não lê partidas';
end $$;
do $$ begin
  perform id from public.jogadores;
  raise exception 'FALHOU: anon leu perfis';
exception when insufficient_privilege then raise notice 'ok - role anon não lê perfis';
end $$;
select pg_temp.checar((select count(*) from public.dificuldades) = 3, 'catálogo público segue legível sem login');

rollback;
