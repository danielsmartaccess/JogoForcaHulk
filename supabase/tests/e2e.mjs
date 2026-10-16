// Teste ponta a ponta de autenticação e persistência, com o mesmo supabase-js do navegador.
// Requer o Supabase LOCAL com confirmação de e-mail ligada (supabase/config.toml) e a caixa
// de e-mail de teste (Mailpit/Inbucket) acessível.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_KEY=<publishable local> \
//   MAIL_URL=http://127.0.0.1:54324 node supabase/tests/e2e.mjs
// (instale antes: npm i @supabase/supabase-js@2.117.2 no diretório de execução)
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_KEY;
const urlEmail = process.env.MAIL_URL || 'http://127.0.0.1:54324';
if (!url || !chave) throw new Error('Defina SUPABASE_URL e SUPABASE_KEY (veja .env.example).');

let falhas = 0;
const checar = (condicao, descricao) => {
  console.log(`${condicao ? 'ok  ' : 'FALHOU'} - ${descricao}`);
  if (!condicao) falhas += 1;
};
const rpc = async (cliente, nome, params) => {
  const { data, error } = await cliente.rpc(nome, params);
  if (error) throw Object.assign(new Error(`${nome}: ${error.message}`), { codigo: error.code });
  return data;
};

// Armazenamento em memória que imita o localStorage: compartilhá-lo entre dois clientes
// simula "atualizar a página" (a sessão persistida é recuperada).
const novoArmazenamento = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};
const novoCliente = (armazenamento = novoArmazenamento(), endereco = url) =>
  createClient(endereco, chave, { auth: { storage: armazenamento, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });

const sufixo = Date.now().toString(36);
const emailA = `ana.${sufixo}@teste.com`;
const emailB = `beto.${sufixo}@teste.com`;
const senha = 'senhaForte123';

// Lê o link de confirmação do e-mail enviado ao endereço.
async function linkDeConfirmacao(email) {
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const lista = await (await fetch(`${urlEmail}/api/v1/messages`)).json();
    const msg = (lista.messages || []).find((m) => m.To.some((t) => t.Address === email));
    if (msg) {
      const detalhe = await (await fetch(`${urlEmail}/api/v1/message/${msg.ID}`)).json();
      const href = /href="([^"]+)"/.exec(detalhe.HTML)?.[1];
      return href?.replaceAll('&amp;', '&');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}
async function confirmarEmail(email) {
  const link = await linkDeConfirmacao(email);
  if (!link) return false;
  const resposta = await fetch(link, { redirect: 'manual' });
  return resposta.status >= 300 && resposta.status < 400; // redireciona de volta ao site com a sessão
}

// ------------------------------------------------------------ RF01: cadastro
const armazenamentoA = novoArmazenamento();
const clienteA = novoCliente(armazenamentoA);
const cadastro = await clienteA.auth.signUp({ email: emailA, password: senha, options: { data: { display_name: '  Ana   Banner ' } } });
checar(!cadastro.error && Boolean(cadastro.data.user?.id), 'cadastro com e-mail e senha');
checar(!cadastro.data.session, 'com confirmação ligada, o cadastro NÃO devolve sessão');
const idA = cadastro.data.user.id;

const curta = await novoCliente().auth.signUp({ email: `curta.${sufixo}@teste.com`, password: '123' });
checar(curta.error?.code === 'weak_password', 'senha curta é recusada pelo servidor (weak_password)');
const invalido = await novoCliente().auth.signUp({ email: 'isso-nao-e-email', password: senha });
checar(Boolean(invalido.error), 'e-mail inválido é recusado pelo servidor');

// ------------------------------------------------ confirmação de e-mail / login
const antes = await clienteA.auth.signInWithPassword({ email: emailA, password: senha });
checar(antes.error?.code === 'email_not_confirmed' && !antes.data.session, 'login antes de confirmar o e-mail é recusado (email_not_confirmed)');
checar(await confirmarEmail(emailA), 'e-mail de confirmação entregue e link aceito');

const errada = await clienteA.auth.signInWithPassword({ email: emailA, password: 'senhaErrada999' });
checar(errada.error?.code === 'invalid_credentials', 'login com senha errada: invalid_credentials');
const inexistente = await clienteA.auth.signInWithPassword({ email: `nao.existe.${sufixo}@teste.com`, password: senha });
checar(inexistente.error?.code === 'invalid_credentials' && inexistente.error.message === errada.error.message, 'conta inexistente e senha errada têm a mesma resposta (sem enumeração)');

const repetido = await novoCliente().auth.signUp({ email: emailA, password: 'outraSenha123', options: { data: { display_name: 'Invasor' } } });
checar(!repetido.data.session && (repetido.error || (repetido.data.user?.identities || []).length === 0), 'recadastro de e-mail já confirmado não cria sessão nem revela a conta');

// ----------------------------------------------------------------- RF02: login
const login = await clienteA.auth.signInWithPassword({ email: emailA, password: senha });
checar(!login.error && login.data.session?.user.id === idA, 'login válido devolve sessão do usuário');

// -------------------------------------------------------------- RF05: perfil
const perfil = await rpc(clienteA, 'garantir_perfil');
checar(perfil.nome === 'Ana Banner' && perfil.id === idA && perfil.pontuacao === 0, 'perfil criado no cadastro com o nome de exibição normalizado');
checar(!('email' in perfil) && !('senha' in perfil), 'perfil não contém e-mail nem senha');

// --------------------------------------------------- RF03: sessão persistente
const clienteRecarregado = novoCliente(armazenamentoA); // outro cliente, mesmo armazenamento = "F5"
const recuperada = await clienteRecarregado.auth.getSession();
checar(recuperada.data.session?.user.id === idA, 'sessão é recuperada ao recarregar (getSession)');
const perfilRecarregado = await rpc(clienteRecarregado, 'garantir_perfil');
checar(perfilRecarregado.id === idA && perfilRecarregado.nome === 'Ana Banner', 'perfil é recuperado após recarregar');

// ------------------------------------------------- RF06/RF07: progressão e histórico
const CANDIDATAS = ['HULK', 'THOR', 'FLASH', 'VISAO', 'PANTERA', 'VINGADOR'];
async function jogar(cliente, vencer) {
  const partida = await rpc(cliente, 'iniciar_partida', { p_dificuldade: 'facil', p_categoria: 'herois' });
  let candidatas = CANDIDATAS.filter((p) => p.length === partida.tamanho);
  const tentadas = new Set();
  let ultimo;
  while (!ultimo?.encerrada) {
    let letra;
    if (vencer) {
      const freq = {};
      candidatas.forEach((p) => new Set(p).forEach((l) => { if (!tentadas.has(l)) freq[l] = (freq[l] || 0) + 1; }));
      letra = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
    } else {
      letra = [...'ZYXWQJKBFPGVCMDNHTSRLUOIEA'].find((l) => !tentadas.has(l));
    }
    tentadas.add(letra);
    ultimo = await rpc(cliente, 'tentar_letra', { p_partida_id: partida.partida_id, p_letra: letra });
    candidatas = candidatas.filter((p) => JSON.stringify([...p].flatMap((l, k) => (l === letra ? [k] : []))) === JSON.stringify(ultimo.posicoes));
  }
  return { partida, ultimo };
}
const vitoria = await jogar(clienteA, true);
checar(vitoria.ultimo.status === 'vitoria' && vitoria.ultimo.pontos > 0, `partida concluída com vitória (+${vitoria.ultimo.pontos} pts)`);
const derrota = await jogar(clienteA, false);
checar(derrota.ultimo.status === 'derrota', `partida concluída com derrota (+${derrota.ultimo.pontos} pts)`);

// Repetir a jogada final de uma partida concluída não duplica nada.
let repetiu = null;
try { await rpc(clienteA, 'tentar_letra', { p_partida_id: vitoria.partida.partida_id, p_letra: 'A' }); } catch (e) { repetiu = e; }
checar(repetiu?.codigo === '22023', 'partida concluída não aceita novo registro (sem duplicidade)');

const progresso = await rpc(clienteA, 'obter_perfil');
checar(progresso.partidas_jogadas === 2 && progresso.vitorias === 1 && progresso.derrotas === 1, 'progressão acumulada: 2 partidas, 1 vitória, 1 derrota');
checar(progresso.conquistas.includes('primeira-vitoria') && Boolean(progresso.ultima_partida_em), 'conquista e data da última partida persistidas');

const historico = await clienteA.from('partidas').select('id, modalidade, status, pontos').in('status', ['vitoria', 'derrota']);
checar(!historico.error && historico.data.length === 2 && historico.data.every((p) => p.modalidade === 'forca'), 'histórico do dono lista as 2 partidas concluídas');
const vazamento = await clienteA.from('partidas').select('palavra');
checar(Boolean(vazamento.error), 'palavra secreta não pode ser lida nem pelo dono');

// ----------------------------------------------------------------- RF04: logout
const saida = await clienteA.auth.signOut({ scope: 'local' });
checar(!saida.error, 'logout (signOut local) sem erro');
const aposSair = await novoCliente(armazenamentoA).auth.getSession();
checar(!aposSair.data.session, 'depois do logout, recarregar NÃO recupera sessão');
let semLogin = null;
try { await rpc(novoCliente(), 'obter_perfil'); } catch (e) { semLogin = e; }
checar(Boolean(semLogin), 'sem sessão, as RPCs são recusadas');

// ---------------------------------------- login de novo: dados continuam salvos
const clienteA2 = novoCliente();
await clienteA2.auth.signInWithPassword({ email: emailA, password: senha });
const recuperado = await rpc(clienteA2, 'garantir_perfil');
checar(recuperado.pontuacao === progresso.pontuacao && recuperado.partidas_jogadas === 2, 'após novo login, pontuação e partidas foram recuperadas');
checar(recuperado.conquistas.length === progresso.conquistas.length, 'conquistas recuperadas');

// -------------------------------------- RF09: isolamento entre dois jogadores
const clienteB = novoCliente();
const cadB = await clienteB.auth.signUp({ email: emailB, password: senha, options: { data: { display_name: 'Beto' } } });
await confirmarEmail(emailB);
const loginB = await clienteB.auth.signInWithPassword({ email: emailB, password: senha });
checar(!loginB.error, 'segundo jogador cadastrado, confirmado e autenticado');
const perfilB = await rpc(clienteB, 'garantir_perfil');
checar(perfilB.id === cadB.data.user.id && perfilB.pontuacao === 0, 'segundo jogador começa do zero');

const lerPerfis = await clienteB.from('jogadores').select('id, nome');
checar(!lerPerfis.error && lerPerfis.data.length === 1 && lerPerfis.data[0].id === perfilB.id, 'B só lê o próprio perfil');
const lerHist = await clienteB.from('partidas').select('id');
checar(!lerHist.error && lerHist.data.length === 0, 'B não lê o histórico de A');
const lerConq = await clienteB.from('jogador_conquistas').select('conquista_id');
checar(!lerConq.error && lerConq.data.length === 0, 'B não lê as conquistas de A');
const alterarA = await clienteB.from('jogadores').update({ nome: 'hack' }).eq('id', idA).select();
checar(!alterarA.error && alterarA.data.length === 0, 'B não altera o perfil de A (0 linhas)');
const alterarPlacar = await clienteB.from('jogadores').update({ pontuacao: 999999 }).eq('id', perfilB.id);
checar(Boolean(alterarPlacar.error), 'B não altera nem a própria pontuação');
const inserirPerfil = await clienteB.from('jogadores').insert({ id: idA, nome: 'Clone' });
checar(Boolean(inserirPerfil.error), 'B não insere perfil para outro usuário');
const apagar = await clienteB.from('jogadores').delete().eq('id', idA);
checar(Boolean(apagar.error), 'B não apaga perfil de A');
const inserirPartida = await clienteB.from('partidas').insert({ jogador_id: idA, dificuldade: 'facil', categoria: 'geral', palavra: 'X', status: 'vitoria', pontos: 9999 });
checar(Boolean(inserirPartida.error), 'B não registra partidas em nome de A');
let jogadaAlheia = null;
try { await rpc(clienteB, 'tentar_letra', { p_partida_id: vitoria.partida.partida_id, p_letra: 'A' }); } catch (e) { jogadaAlheia = e; }
checar(Boolean(jogadaAlheia), 'B não joga em partida de A');

const nomeNoPerfil = (await clienteA2.from('jogadores').select('nome').single()).data.nome;
checar(nomeNoPerfil === 'Ana Banner', 'perfil de A segue intacto depois das tentativas de B');
const ranking = await rpc(clienteB, 'obter_ranking', { p_limite: 10 });
checar(ranking.every((l) => Object.keys(l).sort().join() === 'eh_voce,nivel,nome,pontuacao,posicao'), 'ranking público expõe só nome, pontos, nível e posição (sem e-mail)');

// --------------------------------------------------------- RF14: falha de rede
const semRede = novoCliente(novoArmazenamento(), 'http://127.0.0.1:9');
const loginSemRede = await semRede.auth.signInWithPassword({ email: emailA, password: senha });
checar(loginSemRede.error?.name === 'AuthRetryableFetchError' && !loginSemRede.data.session, 'login sem rede falha de forma identificável (AuthRetryableFetchError)');
const rpcSemRede = await semRede.rpc('obter_estatisticas');
checar(Boolean(rpcSemRede.error) && !rpcSemRede.error.code && /fetch|network/i.test(rpcSemRede.error.message), 'RPC sem rede falha sem código (a interface trata como falha de conexão)');

// ----------------------------------------------------------------- limpeza
for (const c of [clienteA2, clienteB]) await c.auth.signOut({ scope: 'local' });
console.log(falhas ? `\n${falhas} falha(s).` : '\nTodos os testes E2E passaram.');
process.exit(falhas ? 1 : 0);
