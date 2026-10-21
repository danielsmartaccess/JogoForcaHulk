-- ============================================================================
-- FORCA GAMA — pontuação multiplicada pela dificuldade
--
-- Regra anterior: os pontos vinham de uma base por dificuldade (40 / 90 / 150),
-- sem relação com o multiplicador (x1 / x2 / x3) exibido ao jogador.
-- Regra nova: uma base única (40) e o multiplicador escala o total da partida.
--   vitória: (base + 5 x letras distintas acertadas) x multiplicador
--   derrota: round(20% x base x multiplicador)
-- Pontos cognitivos, nível (pontuação / 300 + 1), conquistas e metas de recompensa
-- não mudam. Partidas já concluídas mantêm os pontos que receberam.
--
-- A mesma regra existe no modo local: aplicarFimDePartidaLocal em script.js.
-- ============================================================================

update public.dificuldades set pontos = 40;

comment on column public.dificuldades.pontos is
  'Base de pontos de uma vitória, antes do multiplicador da dificuldade.';

create or replace function public.tentar_letra(p_partida_id uuid, p_letra text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := interno.exigir_usuario();
  v_letra      text := upper(btrim(coalesce(p_letra, '')));
  v_partida    public.partidas;
  v_jogador    public.jogadores;
  v_dif        public.dificuldades;
  v_acertou    boolean;
  v_venceu     boolean := false;
  v_encerrada  boolean := false;
  v_posicoes   integer[];
  v_acertos    integer;
  v_pontos     integer := 0;
  v_cognitivos integer := 0;
  v_novidades  text[] := '{}';
begin
  if v_letra !~ '^[A-Z]$' then
    raise exception 'Letra inválida.' using errcode = '22023';
  end if;

  -- FOR UPDATE serializa cliques rápidos na mesma partida.
  select * into v_partida from public.partidas
   where id = p_partida_id and jogador_id = v_uid
   for update;
  if not found then
    raise exception 'Partida não encontrada.' using errcode = 'P0002';
  end if;
  if v_partida.status <> 'em_andamento' then
    raise exception 'Esta partida já foi encerrada.' using errcode = '22023';
  end if;

  if v_letra = any (v_partida.letras_tentadas) then
    return jsonb_build_object('repetida', true, 'letra', v_letra, 'erros', v_partida.erros, 'status', v_partida.status);
  end if;

  v_acertou := strpos(v_partida.palavra, v_letra) > 0;
  select coalesce(array_agg(i - 1 order by i), '{}') into v_posicoes
    from generate_series(1, char_length(v_partida.palavra)) as i
   where substr(v_partida.palavra, i, 1) = v_letra;

  update public.partidas
     set letras_tentadas = letras_tentadas || v_letra,
         letras_corretas = case when v_acertou then letras_corretas || v_letra else letras_corretas end,
         erros           = erros + case when v_acertou then 0 else 1 end
   where id = v_partida.id
  returning * into v_partida;

  update public.jogadores
     set sequencia_letras        = case when v_acertou then sequencia_letras + 1 else 0 end,
         melhor_sequencia_letras = greatest(melhor_sequencia_letras, case when v_acertou then sequencia_letras + 1 else 0 end),
         visto_em                = now()
   where id = v_uid;

  v_venceu := not exists (
    select 1 from regexp_split_to_table(v_partida.palavra, '') as l (letra)
     where not (l.letra = any (v_partida.letras_corretas)));
  v_encerrada := v_venceu or v_partida.erros >= 6;

  if v_encerrada then
    select * into v_dif from public.dificuldades where slug = v_partida.dificuldade;
    v_acertos    := cardinality(v_partida.letras_corretas);
    v_pontos     := case when v_venceu then (v_dif.pontos + v_acertos * 5) * v_dif.multiplicador
                         else round(v_dif.pontos * v_dif.multiplicador * 0.2)::integer end;
    v_cognitivos := v_dif.cognitivo + v_acertos + case when v_venceu then 5 else 0 end;

    update public.partidas
       set status = case when v_venceu then 'vitoria' else 'derrota' end,
           pontos = v_pontos, pontos_cognitivos = v_cognitivos, finalizada_em = now()
     where id = v_partida.id
    returning * into v_partida;

    update public.jogadores
       set partidas_jogadas          = partidas_jogadas + 1,
           pontuacao                 = pontuacao + v_pontos,
           pontos_cognitivos         = pontos_cognitivos + v_cognitivos,
           letras_descobertas        = letras_descobertas + v_acertos,
           vitorias                  = vitorias + v_venceu::integer,
           derrotas                  = derrotas + (not v_venceu)::integer,
           sequencia_vitorias        = case when v_venceu then sequencia_vitorias + 1 else 0 end,
           melhor_sequencia_vitorias = greatest(melhor_sequencia_vitorias, case when v_venceu then sequencia_vitorias + 1 else 0 end),
           vitorias_dificil          = vitorias_dificil + (v_venceu and v_partida.dificuldade = 'dificil')::integer
     where id = v_uid
    returning * into v_jogador;

    v_novidades := interno.avaliar_progressao(v_jogador, v_dif.multiplicador);
  end if;

  return jsonb_build_object(
    'repetida',          false,
    'letra',             v_letra,
    'acertou',           v_acertou,
    'posicoes',          to_jsonb(v_posicoes),
    'erros',             v_partida.erros,
    'status',            v_partida.status,
    'encerrada',         v_encerrada,
    'venceu',            v_venceu,
    'palavra',           case when v_encerrada then v_partida.palavra end,
    'pontos',            v_pontos,
    'pontos_cognitivos', v_cognitivos,
    'novidades',         to_jsonb(v_novidades),
    'jogador',           interno.perfil_json(v_uid));
end;
$$;

-- CREATE OR REPLACE preserva as permissões, mas reafirmamos o contrato.
revoke execute on function public.tentar_letra(uuid, text) from public, anon, authenticated;
grant  execute on function public.tentar_letra(uuid, text) to authenticated;
