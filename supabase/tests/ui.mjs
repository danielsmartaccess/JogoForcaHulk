// Teste de interface: executa o index.html + scripts REAIS em jsdom contra o Supabase local.
// Não substitui teste em navegador de verdade (layout, foco real e CSS não são avaliados).
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_KEY=<publishable local> MAIL_URL=http://127.0.0.1:54324 \
//   node supabase/tests/ui.mjs <pasta-do-site>
// Instale antes, no diretório de execução: npm i jsdom @supabase/supabase-js@2.117.2
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';

const raiz = process.argv[2] || '.';
const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_KEY;
const urlEmail = process.env.MAIL_URL || 'http://127.0.0.1:54324';
if (!url || !chave) throw new Error('Defina SUPABASE_URL e SUPABASE_KEY.');
const umd = fs.readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const ler = (f) => fs.readFileSync(`${raiz}/${f}`, 'utf8');

let falhas = 0;
const checar = (condicao, descricao) => {
  console.log(`${condicao ? 'ok  ' : 'FALHOU'} - ${descricao}`);
  if (!condicao) falhas += 1;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(condicao, descricao, ms = 8000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (condicao()) return true;
    await dormir(50);
  }
  console.log(`   (tempo esgotado esperando: ${descricao})`);
  return false;
}

// Abre uma "aba": mesmo HTML/JS do site, localStorage pré-carregado (simula recarregar a página).
function abrirPagina(armazenado = new Map(), { semServidor = false } = {}) {
  const erros = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/scrollTo/.test(e.message)) erros.push(e.message); });
  if (process.env.UI_DEBUG) vc.on('warn', (...m) => console.log('   [console.warn]', ...m));
  const dom = new JSDOM(ler('index.html').replace(/<script[^>]*><\/script>/g, ''), {
    url: 'http://localhost:3000/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { armazenado.forEach((v, k) => w.localStorage.setItem(k, v)); },
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.AbortSignal = AbortSignal; w.Headers = Headers; w.Request = Request; w.Response = Response;
  w.__offline = false;
  w.__atrasoRanking = 0; // ms de atraso artificial no ranking, para observar o estado "carregando"
  w.fetch = async (...a) => {
    if (w.__offline) throw new TypeError('Failed to fetch');
    if (w.__atrasoRanking && String(a[0]).includes('/rpc/obter_ranking')) await dormir(w.__atrasoRanking);
    return fetch(...a);
  };
  const aparicoes = { autenticacao: false };
  new w.MutationObserver(() => { if (!w.document.getElementById('tela-autenticacao').hidden) aparicoes.autenticacao = true; })
    .observe(w.document.getElementById('tela-autenticacao'), { attributes: true, attributeFilter: ['hidden'] });
  if (!semServidor) w.eval(umd); // sem a biblioteca, o jogo cai no modo local
  // Um único eval: os const dos scripts compartilham escopo, como <script> clássicos no navegador.
  w.eval([ler('config.js').replace(/supabaseUrl: '[^']*'/, `supabaseUrl: '${url}'`).replace(/supabaseChave: '[^']*'/, `supabaseChave: '${chave}'`),
    ler('servico-supabase.js'), ler('script.js'),
    'window.__t = { get jogador() { return jogador; }, get modoOnline() { return modoOnline; }, banco: BANCO_DE_PALAVRAS, inicializacao };'].join('\n;\n'));
  const $ = (id) => w.document.getElementById(id);
  const visivel = (id) => !$(id).hidden;
  const salvar = () => new Map(Array.from({ length: w.localStorage.length }, (_, i) => [w.localStorage.key(i), w.localStorage.getItem(w.localStorage.key(i))]));
  return { w, $, visivel, erros, aparicoes, salvar };
}

function preencher(pagina, valores) {
  Object.entries(valores).forEach(([id, valor]) => { pagina.$(id).value = valor; });
}
const enviar = (pagina, idForm) => pagina.$(idForm).dispatchEvent(new pagina.w.Event('submit', { cancelable: true }));

async function linkDeConfirmacao(email) {
  for (let i = 0; i < 20; i += 1) {
    const lista = await (await fetch(`${urlEmail}/api/v1/messages`)).json();
    const msg = (lista.messages || []).find((m) => m.To.some((t) => t.Address === email));
    if (msg) {
      const d = await (await fetch(`${urlEmail}/api/v1/message/${msg.ID}`)).json();
      return /href="([^"]+)"/.exec(d.HTML)?.[1]?.replaceAll('&amp;', '&');
    }
    await dormir(300);
  }
  return null;
}

// Joga uma partida até o fim usando só o que a tela mostra (células e letras usadas) + a lista pública de palavras.
async function jogarPelaTela(p, dificuldade, categoria) {
  const palavras = p.w.__t.banco[dificuldade][categoria];
  const tentadas = new Set();
  for (let rodada = 0; rodada < 30 && !p.visivel('tela-resultado'); rodada += 1) {
    const celulas = [...p.w.document.querySelectorAll('.celula-letra')].map((c) => c.textContent);
    const erradas = [...p.w.document.querySelectorAll('.chip-errada')].map((c) => c.textContent);
    const candidatas = palavras.filter((pal) => pal.length === celulas.length
      && celulas.every((l, i) => !l || pal[i] === l) && erradas.every((l) => !pal.includes(l)));
    const freq = {};
    candidatas.forEach((pal) => new Set(pal).forEach((l) => { if (!tentadas.has(l)) freq[l] = (freq[l] || 0) + 1; }));
    const letra = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
    tentadas.add(letra);
    const antes = p.w.document.querySelectorAll('.chip-letra').length;
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: letra }));
    await ate(() => p.visivel('tela-resultado') || p.w.document.querySelectorAll('.chip-letra').length > antes, `resposta da letra ${letra}`);
  }
}

const sufixo = Date.now().toString(36);
const email = `ui.${sufixo}@teste.com`;
const senha = 'senhaForte123';

// ============================================================ página 1: cadastro e primeiro uso
let p = abrirPagina();
checar(p.visivel('tela-carregando') && !p.visivel('tela-autenticacao') && !p.visivel('tela-identificacao'), 'ao abrir, só a tela de carregamento aparece');
await p.w.__t.inicializacao;
checar(p.w.__t.modoOnline === true, 'modo online ativo');
checar(p.visivel('tela-autenticacao') && !p.visivel('tela-carregando'), 'sem sessão: tela de login/cadastro');
checar(!p.visivel('tela-identificacao'), 'tela do modo local não aparece quando o servidor responde');

// Validação (nenhuma dessas ações deve chegar ao servidor).
enviar(p, 'form-login');
checar(p.$('erro-login').textContent === 'Informe seu e-mail.' && p.$('login-email').getAttribute('aria-invalid') === 'true', 'login: e-mail vazio é recusado com mensagem clara');
preencher(p, { 'login-email': 'sem-arroba', 'login-senha': 'x' });
enviar(p, 'form-login');
checar(/e-mail válido/.test(p.$('erro-login').textContent), 'login: e-mail em formato inválido');
preencher(p, { 'login-email': 'a@b.com', 'login-senha': '' });
enviar(p, 'form-login');
checar(p.$('erro-login').textContent === 'Informe sua senha.', 'login: senha vazia');

p.$('aba-cadastro').click();
checar(p.visivel('form-cadastro') && !p.visivel('form-login') && p.$('aba-cadastro').getAttribute('aria-selected') === 'true', 'alternância para "Criar conta"');
enviar(p, 'form-cadastro');
checar(p.$('erro-cadastro').textContent === 'Informe um nome de exibição.', 'cadastro: nome vazio');
preencher(p, { 'cadastro-nome': 'Ana', 'cadastro-email': 'ana@exemplo.com', 'cadastro-senha': '1234567', 'cadastro-confirmacao': '1234567' });
enviar(p, 'form-cadastro');
checar(/pelo menos 8/.test(p.$('erro-cadastro').textContent), 'cadastro: senha com menos de 8 caracteres');
preencher(p, { 'cadastro-senha': 'senhaForte123', 'cadastro-confirmacao': 'senhaDiferente' });
enviar(p, 'form-cadastro');
checar(/não é igual/.test(p.$('erro-cadastro').textContent) && p.$('cadastro-confirmacao').getAttribute('aria-invalid') === 'true', 'cadastro: confirmação diferente da senha');
preencher(p, { 'cadastro-nome': 'x'.repeat(30) });
enviar(p, 'form-cadastro');
checar(/até 24/.test(p.$('erro-cadastro').textContent), 'cadastro: nome acima de 24 caracteres');

// Cadastro válido com confirmação de e-mail ligada.
preencher(p, { 'cadastro-nome': '  Ana   Banner ', 'cadastro-email': email, 'cadastro-senha': senha, 'cadastro-confirmacao': senha });
enviar(p, 'form-cadastro');
await ate(() => p.visivel('aviso-confirmacao'), 'aviso de confirmação');
checar(p.visivel('aviso-confirmacao') && p.$('aviso-confirmacao').textContent.includes(email), 'cadastro: orienta a confirmar o e-mail (não presume login)');
checar(p.visivel('form-login') && p.$('login-email').value === email && !p.visivel('tela-painel'), 'cadastro: volta ao login com o e-mail preenchido, sem entrar');
checar(p.$('cadastro-senha').value === '' && p.$('cadastro-confirmacao').value === '', 'cadastro: campos de senha são limpos');

// Login antes de confirmar.
preencher(p, { 'login-senha': senha });
enviar(p, 'form-login');
await ate(() => !p.$('erro-login').hidden, 'erro de e-mail não confirmado');
checar(/Confirme seu e-mail/.test(p.$('erro-login').textContent) && !p.visivel('tela-painel'), 'login antes de confirmar: mensagem orienta a confirmar');

// Confirma o e-mail como o jogador faria (clicando no link).
const link = await linkDeConfirmacao(email);
checar(Boolean(link) && (await fetch(link, { redirect: 'manual' })).status >= 300, 'link de confirmação recebido e aceito');

// Senha errada, depois certa.
preencher(p, { 'login-senha': 'senhaErrada999' });
enviar(p, 'form-login');
await ate(() => /incorretos/.test(p.$('erro-login').textContent), 'erro de credenciais');
checar(p.$('erro-login').textContent === 'E-mail ou senha incorretos.' && !p.visivel('tela-painel'), 'login inválido: mensagem genérica');
preencher(p, { 'login-email': email, 'login-senha': senha });
p.w.__atrasoRanking = 800; // segura o ranking para observar o painel enquanto os dados reais não chegam
enviar(p, 'form-login');
await ate(() => p.visivel('tela-painel'), 'painel');
checar(p.visivel('tela-painel'), 'login válido abre o painel');
checar(p.$('online-geral').textContent === '—' && p.$('lista-ranking').textContent.includes('Carregando') && !/CARLOS|MARIA|LUCAS/.test(p.$('lista-ranking').textContent),
  'modo online: enquanto os dados reais carregam, nada simulado aparece');
checar(p.$('rotulo-dados-online').textContent !== 'Dados em tempo real', 'modo online: o rótulo não afirma "tempo real" antes de os dados chegarem');
await ate(() => /^\d/.test(p.$('online-geral').textContent) && !p.$('lista-ranking').textContent.includes('Carregando'), 'dados reais do painel');
p.w.__atrasoRanking = 0;
checar(p.$('rotulo-dados-online').textContent === 'Dados em tempo real' && p.$('selo-ranking').textContent === 'AO VIVO', 'modo online: com os dados reais, os rótulos de tempo real aparecem');
checar(p.$('nome-painel').textContent === 'Ana Banner' && p.$('nome-cabecalho').textContent === 'Ana Banner', 'saudação com o nome de exibição normalizado');
checar(p.$('trocar-usuario-cabecalho').textContent === 'Sair' && p.$('sinal-modo').textContent.includes('ONLINE'), 'interface em modo online (botão "Sair")');
checar(p.$('subtitulo-painel').textContent.startsWith('Escolha um desafio'), 'primeiro acesso: sem mensagem de retorno');

// Partida completa pela tela.
p.$('opcoes-dificuldade').querySelector('[data-dificuldade="facil"]').click();
await ate(() => p.w.document.querySelector('[data-categoria="herois"]'), 'categoria heróis');
p.w.document.querySelector('[data-categoria="herois"]').click();
await ate(() => p.visivel('tela-partida'), 'partida');
checar(p.visivel('tela-partida') && [...p.w.document.querySelectorAll('.celula-letra')].every((c) => !c.textContent), 'partida inicia com a palavra oculta');
const atalho = new p.w.KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true });
p.w.document.dispatchEvent(atalho);
checar(!atalho.defaultPrevented && p.w.document.querySelectorAll('.chip-letra').length === 0, 'atalho Ctrl+letra não vira jogada nem é bloqueado');
await jogarPelaTela(p, 'facil', 'herois');
checar(p.visivel('tela-resultado'), 'partida termina e mostra o resultado');
checar(/^A palavra era: [A-Z]+$/.test(p.$('palavra-revelada-resultado').textContent), 'resultado revela a palavra só no fim');
const pontosGanhos = Number(p.$('pontos-resultado').textContent.replace('+', ''));
checar(pontosGanhos > 0, `pontos da partida: +${pontosGanhos}`);
p.$('botao-voltar-painel').click();
const pontuacao = p.$('pontuacao-jogador').textContent;
checar(p.visivel('tela-painel') && Number(pontuacao.replace(/\D/g, '')) === pontosGanhos, 'painel mostra a pontuação persistida');

// Histórico no modal de progresso.
p.w.document.querySelector('[data-modal="progresso"]').click();
await ate(() => p.w.document.querySelector('.historico-partidas li'), 'histórico');
checar(p.w.document.querySelectorAll('.historico-partidas li').length === 1 && /Vitória/.test(p.w.document.querySelector('.historico-partidas li').textContent), 'modal de progresso lista a partida concluída');
checar(p.erros.length === 0, `sem erros de script na página 1${p.erros.length ? `: ${p.erros[0]}` : ''}`);
const armazenado = p.salvar();
checar([...armazenado.keys()].some((k) => k.startsWith('sb-')), 'a sessão fica guardada pelo supabase-js');
checar([...armazenado.keys()].every((k) => k.startsWith('sb-')), 'a aplicação não grava dados próprios no localStorage no modo online');

// ============================================================ página 2: "F5" com sessão válida
p = abrirPagina(armazenado);
checar(p.visivel('tela-carregando') && !p.visivel('tela-autenticacao'), 'recarregar: começa em "carregando", sem exibir o login');
await ate(() => p.visivel('tela-painel'), 'painel após recarregar');
checar(p.visivel('tela-painel') && !p.aparicoes.autenticacao, 'recarregar: vai direto ao painel; o login nunca aparece');
checar(p.$('nome-painel').textContent === 'Ana Banner', 'recarregar: recupera o perfil');
checar(p.$('pontuacao-jogador').textContent === pontuacao && p.$('vitorias-jogador').textContent === '1', 'recarregar: recupera a progressão');
checar(/Bem-vindo de volta/.test(p.$('subtitulo-painel').textContent), 'recarregar: mensagem de boas-vindas ao retorno');
checar(p.w.document.querySelectorAll('#lista-conquistas .liberada').length >= 1, 'recarregar: conquistas desbloqueadas aparecem');

// ============================================================ logout
p.$('trocar-usuario-cabecalho').click();
await ate(() => p.visivel('tela-autenticacao'), 'tela de login após sair');
checar(p.visivel('tela-autenticacao') && !p.visivel('tela-painel'), 'logout: volta à tela de autenticação');
checar(p.w.__t.jogador === null && p.$('nome-painel').textContent === '' && p.$('nome-cabecalho').textContent === '', 'logout: dados privados saem da memória e da tela');
checar(p.$('lista-ranking').children.length === 0 && p.$('opcoes-categoria').children.length === 0, 'logout: ranking e categorias são descartados');
checar(![...p.salvar().keys()].some((k) => k.startsWith('sb-auth-token')), 'logout: sessão removida do armazenamento');
const apos = p.salvar();

p = abrirPagina(apos);
await ate(() => p.visivel('tela-autenticacao'), 'login após sair e recarregar');
checar(p.visivel('tela-autenticacao') && !p.visivel('tela-painel'), 'depois do logout, recarregar NÃO restaura a sessão');

// Entrar de novo: tudo continua salvo.
preencher(p, { 'login-email': email, 'login-senha': senha });
enviar(p, 'form-login');
await ate(() => p.visivel('tela-painel'), 'painel após novo login');
checar(p.$('pontuacao-jogador').textContent === pontuacao && p.$('vitorias-jogador').textContent === '1', 'novo login: progressão recuperada');

// ============================================================ falha de rede
p.$('trocar-usuario-cabecalho').click();
await ate(() => p.visivel('tela-autenticacao'), 'login para teste offline');
p.w.__offline = true;
preencher(p, { 'login-email': email, 'login-senha': senha });
enviar(p, 'form-login');
await ate(() => !p.$('erro-login').hidden, 'erro de rede');
checar(/conectar ao servidor/.test(p.$('erro-login').textContent) && !p.visivel('tela-painel'), 'sem rede: login mostra falha de conexão (não finge sucesso)');
checar(!p.$('form-login').querySelector('button').disabled, 'sem rede: botão volta a ficar disponível para nova tentativa');
p.w.__offline = false;
enviar(p, 'form-login');
await ate(() => p.visivel('tela-painel'), 'painel após reconectar');
checar(p.visivel('tela-painel'), 'rede de volta: nova tentativa entra normalmente');

// Falha ao carregar o perfil: tela com "Tentar novamente" e dados intactos.
const salvoLogado = p.salvar();
p = abrirPagina(salvoLogado);
p.w.__offline = true;
await ate(() => p.visivel('tela-carregando') && !p.$('acoes-carregando').hidden, 'tela de falha de carga');
checar(!p.$('acoes-carregando').hidden && !p.visivel('tela-autenticacao'), 'sem rede ao recarregar: oferece "Tentar novamente" (não derruba a sessão)');
p.w.__offline = false;
p.$('botao-tentar-novamente').click();
await ate(() => p.visivel('tela-painel'), 'painel após tentar novamente');
checar(p.visivel('tela-painel') && p.$('pontuacao-jogador').textContent === pontuacao, 'tentar novamente recupera a jornada com os dados remotos');

// ============================================================ sessão expirada/inválida
const adulterado = new Map(salvoLogado);
for (const [k, v] of adulterado) {
  if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue;
  const sessao = JSON.parse(v);
  sessao.access_token = `${sessao.access_token.slice(0, -6)}XXXXXX`; // assinatura inválida
  adulterado.set(k, JSON.stringify(sessao));
}
p = abrirPagina(adulterado);
await ate(() => p.visivel('tela-autenticacao'), 'login após sessão inválida');
checar(p.visivel('tela-autenticacao') && /sessão expirou/.test(p.$('erro-login').textContent), 'token inválido/expirado: volta ao login com aviso claro');
checar(p.w.__t.jogador === null, 'token inválido: nenhum dado privado fica em memória');

// ============================================================ modo local (regressão do jogo original)
p = abrirPagina(new Map(), { semServidor: true });
await p.w.__t.inicializacao;
checar(p.w.__t.modoOnline === false && p.visivel('tela-identificacao') && !p.visivel('tela-autenticacao'), 'sem servidor: segue o modo local com o formulário de apelido');
checar(/modo offline/.test(p.$('texto-identificacao').textContent), 'modo local avisa que o progresso fica só neste navegador');
preencher(p, { 'nome-jogador': 'Dani' });
enviar(p, 'form-identificacao');
await ate(() => p.visivel('tela-painel'), 'painel no modo local');
checar(p.visivel('tela-painel') && p.$('nome-painel').textContent === 'Dani' && p.$('trocar-usuario-cabecalho').textContent === 'Trocar', 'modo local: painel e botão "Trocar" originais');
p.$('opcoes-dificuldade').querySelector('[data-dificuldade="facil"]').click();
p.w.document.querySelector('[data-categoria="herois"]').click();
await ate(() => p.visivel('tela-partida'), 'partida no modo local');
await jogarPelaTela(p, 'facil', 'herois');
checar(p.visivel('tela-resultado') && /^\+\d+$/.test(p.$('pontos-resultado').textContent), 'modo local: partida completa funciona (regras locais)');
p.$('botao-voltar-painel').click();
const salvoLocal = p.salvar();
checar(salvoLocal.has('forcaGama.player.v1'), 'modo local: progresso salvo no localStorage');
p = abrirPagina(salvoLocal, { semServidor: true });
await p.w.__t.inicializacao;
checar(p.visivel('tela-identificacao') && /Dani/.test(p.$('mensagem-retorno').textContent), 'modo local: recarregar reconhece o jogador salvo');
checar(p.erros.length === 0, 'modo local: sem erros de script');

console.log(falhas ? `\n${falhas} falha(s).` : '\nTodos os testes de interface passaram.');
process.exit(falhas ? 1 : 0);
