/* ============================================================================
   FORCA GAMA — integração com o Supabase
   Camada fina sobre o supabase-js: login anônimo e chamadas às funções do
   banco. As regras de pontuação vivem em supabase/migrations; aqui só há
   transporte. Se algo falhar ao conectar, o jogo segue no modo local.
   ============================================================================ */

const ServicoOnline = (() => {
  const TEMPO_LIMITE_MS = 6000;
  let cliente = null;

  async function chamar(funcao, parametros) {
    const { data, error } = await cliente.rpc(funcao, parametros).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
    if (error) throw error;
    return data;
  }

  async function idDoUsuario() {
    const { data } = await cliente.auth.getSession();
    return data.session?.user?.id || null;
  }

  return {
    // true quando o backend responde; false mantém o jogo no modo local.
    async conectar() {
      const config = window.FORCA_CONFIG;
      if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.supabaseChave) return false;
      try {
        cliente = window.supabase.createClient(config.supabaseUrl, config.supabaseChave);
        const { error } = await cliente.from('dificuldades').select('slug').limit(1).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
        if (error) throw error;
        return true;
      } catch (erro) {
        console.warn('Supabase indisponível; usando o modo local.', erro);
        cliente = null;
        return false;
      }
    },
    async temSessao() { return Boolean(await idDoUsuario()); },
    // Login anônimo: o jogador só informa um apelido, como no modo local.
    async entrar() {
      if (await idDoUsuario()) return;
      const { error } = await cliente.auth.signInAnonymously();
      if (error) throw error;
    },
    async sair() { await cliente.auth.signOut(); },
    registrarJogador: (nome) => chamar('registrar_jogador', { p_nome: nome }),
    obterPerfil: () => chamar('obter_perfil'),
    iniciarPartida: (dificuldade, categoria) => chamar('iniciar_partida', { p_dificuldade: dificuldade, p_categoria: categoria }),
    tentarLetra: (partidaId, letra) => chamar('tentar_letra', { p_partida_id: partidaId, p_letra: letra }),
    obterRanking: (limite = 10) => chamar('obter_ranking', { p_limite: limite }),
    obterEstatisticas: () => chamar('obter_estatisticas'),
    // Só preferências: o placar é protegido por grants de coluna no banco.
    async salvarPreferencias({ difficulty, category, isPlus }) {
      const id = await idDoUsuario();
      if (!id) return;
      const { error } = await cliente.from('jogadores')
        .update({ dificuldade: difficulty, categoria: category, is_plus: isPlus })
        .eq('id', id);
      if (error) throw error;
    },
  };
})();
