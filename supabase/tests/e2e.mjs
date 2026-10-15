// Teste ponta a ponta com o mesmo supabase-js usado no navegador.
// Uso: SUPABASE_URL=... SUPABASE_KEY=... node supabase/tests/e2e.mjs
// (requer `npm i @supabase/supabase-js` no diretório de execução)
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_KEY;
if (!url || !chave) throw new Error('Defina SUPABASE_URL e SUPABASE_KEY.');

let falhas = 0;
const checar = (condicao, descricao) => {
  console.log(`${condicao ? 'ok  ' : 'FALHOU'} - ${descricao}`);
  if (!condicao) falhas += 1;
};
const rpc = async (cliente, nome, params) => {
  const { data, error } = await cliente.rpc(nome, params);
  if (error) throw new Error(`${nome}: ${error.message}`);
  return data;
};
const novoCliente = () => createClient(url, chave, { auth: { persistSession: false } });

const anonimo = novoCliente();
const { error: erroCatalogo, data: difs } = await anonimo.from('dificuldades').select('slug');
checar(!erroCatalogo && difs.length === 3, 'catálogo público legível sem login');
const { error: erroRpcSemLogin } = await anonimo.rpc('obter_estatisticas');
checar(Boolean(erroRpcSemLogin), 'RPC bloqueada sem login');

const cliente = novoCliente();
const { error: erroLogin } = await cliente.auth.signInAnonymously();
checar(!erroLogin, `login anônimo ${erroLogin ? `(${erroLogin.message})` : ''}`);

const perfil = await rpc(cliente, 'registrar_jogador', { p_nome: 'Teste E2E' });
checar(perfil.nome === 'Teste E2E' && perfil.pontuacao === 0, 'perfil registrado');

// Solver: conhece só a lista pública de palavras da categoria (facil/herois) e
// usa as posições devolvidas pelo servidor para filtrar candidatas.
const CANDIDATAS = ['HULK', 'THOR', 'FLASH', 'VISAO', 'PANTERA', 'VINGADOR'];
const ERRADAS = 'ZYXWQJKBFPGVCMDNHTSRLUOIEA';
const resultados = new Set();
let palavraVazou = false;
for (let i = 0; i < 8 && resultados.size < 2; i += 1) {
  const partida = await rpc(cliente, 'iniciar_partida', { p_dificuldade: 'facil', p_categoria: 'herois' });
  if (i === 0) checar(partida.tamanho > 0 && !('palavra' in partida), 'partida iniciada sem revelar a palavra');
  const querVencer = i % 2 === 0;
  let candidatas = CANDIDATAS.filter((palavra) => palavra.length === partida.tamanho);
  const tentadas = new Set();
  let ultimo;
  while (!ultimo?.encerrada) {
    let letra;
    if (querVencer) {
      const frequencia = {};
      candidatas.forEach((palavra) => new Set(palavra).forEach((l) => { if (!tentadas.has(l)) frequencia[l] = (frequencia[l] || 0) + 1; }));
      letra = Object.keys(frequencia).sort((a, b) => frequencia[b] - frequencia[a])[0];
    } else {
      letra = [...ERRADAS].find((l) => !tentadas.has(l));
    }
    tentadas.add(letra);
    ultimo = await rpc(cliente, 'tentar_letra', { p_partida_id: partida.partida_id, p_letra: letra });
    if (!ultimo.encerrada && ultimo.palavra !== null) palavraVazou = true;
    candidatas = candidatas.filter((palavra) => {
      const posicoes = [...palavra].flatMap((l, k) => (l === letra ? [k] : []));
      return JSON.stringify(posicoes) === JSON.stringify(ultimo.posicoes);
    });
  }
  resultados.add(ultimo.status);
  checar(ultimo.palavra?.length === partida.tamanho && ultimo.pontos > 0 && (ultimo.status === 'vitoria') === ultimo.venceu,
    `partida ${i + 1}: ${ultimo.status}, ${ultimo.palavra}, +${ultimo.pontos}`);
}

checar(!palavraVazou, 'palavra oculta em todas as jogadas intermediárias');
checar(resultados.has('vitoria') && resultados.has('derrota'), 'houve vitória e derrota');

const atual = await rpc(cliente, 'obter_perfil');
checar(atual.partidas_jogadas >= 2 && atual.pontuacao > 0, `perfil acumulado: ${atual.partidas_jogadas} partidas, ${atual.pontuacao} pts`);

const ranking = await rpc(cliente, 'obter_ranking', { p_limite: 10 });
checar(ranking.some((linha) => linha.eh_voce && linha.pontuacao === atual.pontuacao), 'jogador aparece no ranking');
checar(ranking.every((linha) => Object.keys(linha).sort().join() === 'eh_voce,nivel,nome,pontuacao,posicao'), 'ranking não expõe dados extras');

const estat = await rpc(cliente, 'obter_estatisticas');
checar(estat.online >= 1 && estat.palavras.facil.herois === 6, 'estatísticas reais');

const { error: erroPref } = await cliente.from('jogadores').update({ is_plus: true, categoria: 'musica' }).eq('id', atual.id);
checar(!erroPref, 'preferências atualizáveis');

const { error: erroTrapaca } = await cliente.from('jogadores').update({ pontuacao: 999999 }).eq('id', atual.id);
checar(Boolean(erroTrapaca), 'trapaça: alterar pontuação é bloqueado');
const { data: palavras, error: erroPalavras } = await cliente.from('palavras').select('palavra');
checar(Boolean(erroPalavras) || palavras.length === 0, 'trapaça: tabela de palavras inacessível');
const { data: partidas, error: erroPartidas } = await cliente.from('partidas').select('palavra');
checar(Boolean(erroPartidas) || partidas.length === 0, 'trapaça: tabela de partidas inacessível');

const intruso = novoCliente();
await intruso.auth.signInAnonymously();
const { data: perfisAlheios } = await intruso.from('jogadores').select('*');
checar(perfisAlheios.length === 0, 'outro usuário não lê perfis alheios');

console.log(falhas ? `\n${falhas} falha(s).` : '\nTodos os testes E2E passaram.');
process.exit(falhas ? 1 : 0);
