// Prova B2: a conversa ativa sobrevive a remontar o chat (mesmo mecanismo usado pelo dock). Backend simulado por interceptação.
// Uso: (cd painel && npx vite --port 5182) e depois: node evidencias-issue-166/roteiro-b2-conversa-unica.cjs <captura.png>
const { chromium } = require('playwright');
const C = '11111111-2222-4333-8444-555555555555';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 860 } });
  const chamadas = [];
  await p.route('**/functions/v1/assistente', async (r) => {
    const corpo = JSON.parse(r.request().postData() || '{}'); chamadas.push(corpo.acao + (corpo.conversa_id ? ':' + corpo.conversa_id.slice(0, 8) : ''));
    const resp = {
      provedores: { verificado: true, provedores: [] },
      chat_config: { persistente: true, bling: false, leitura_administrativa: false, retencao_dias: 180 },
      chat_listar: { conversas: [{ id: C, titulo: 'Bomba d’água CI000016', atualizada_em: new Date().toISOString() }] },
      chat_mensagens: { mensagens: [{ id: 'm1', papel: 'usuario', conteudo: 'O que falta no SKU CI000016?', criada_em: new Date().toISOString() }, { id: 'm2', papel: 'assistente', conteudo: 'Faltam GTIN, descrição e imagem.', criada_em: new Date().toISOString() }] },
    }[corpo.acao] ?? { erro: 'não simulado' };
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(resp) });
  });
  await p.route('**/rest/v1/rpc/pode_administrar_loja', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: 'false' }));
  const tem = async () => (await p.innerText('main')).includes('Faltam GTIN, descrição e imagem.');
  // 1) Sem conversa ativa guardada: começa vazio
  await p.goto('http://localhost:5182/?demo=1#/assistente'); await p.waitForTimeout(1500);
  console.log('1. sem conversa guardada mostra histórico?', await tem());
  // 2) Lojista abre a conversa pela lista
  console.log('   chamadas até aqui:', chamadas.join(' ')); await p.evaluate(() => document.querySelector('.nano-conversa')?.click());
  await p.waitForTimeout(800);
  console.log('2. abriu pela lista?', await tem(), '| guardado:', await p.evaluate(() => sessionStorage.getItem('nano:conversa-ativa:demo-loja')));
  // 3) Sai do chat e volta (remonta o componente, como dock <-> tela)
  await p.goto('http://localhost:5182/?demo=1#/catalogo'); await p.waitForTimeout(800);
  await p.goto('http://localhost:5182/?demo=1#/assistente'); await p.waitForTimeout(1500);
  console.log('3. ao voltar, retomou a mesma conversa?', await tem());
  // 4) Nova conversa limpa
  await p.evaluate(() => document.querySelector('.nano-acao-nova')?.click()); await p.waitForTimeout(300);
  console.log('4. nova conversa limpou o guardado?', await p.evaluate(() => sessionStorage.getItem('nano:conversa-ativa:demo-loja')) === null);
  await p.screenshot({ path: process.argv[2] || 'b2.png' });
  console.log('chamadas:', chamadas.join(' '));
  await b.close();
})();
