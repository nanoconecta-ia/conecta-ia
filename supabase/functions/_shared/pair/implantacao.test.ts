import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuracaoPair,PROJETO_CONECTA,PAINEL_CONECTA} from './implantacao.ts';
test('configuração pública do projeto autorizado não depende de segredo adicional',()=>{
  const c=configuracaoPair(k=>k==='SUPABASE_URL'?PROJETO_CONECTA:undefined);
  assert.equal(c.appUrl,PAINEL_CONECTA);assert.equal(c.ambiente,'real');
});
test('ambiente desconhecido não recebe rótulo real e simulação continua explícita',()=>{
  assert.equal(configuracaoPair(()=>undefined).ambiente,'nao_validado');
  assert.equal(configuracaoPair(()=>undefined).appUrl,undefined);
  assert.equal(configuracaoPair(k=>k==='PAIR_AMBIENTE'?'sintetico':PROJETO_CONECTA).ambiente,'sintetico');
  assert.equal(configuracaoPair(k=>k==='PAIR_AMBIENTE'?'invalido':PROJETO_CONECTA).ambiente,'nao_validado');
});

test('configuracaoPair: APP_URL na raiz do site aponta para o painel, não para a vitrine', () => {
  const c = configuracaoPair(k => k === 'APP_URL' ? 'https://www.mobisautopecas.com.br' : k === 'SUPABASE_URL' ? PROJETO_CONECTA : undefined);
  assert.equal(c.appUrl, PAINEL_CONECTA);
});
