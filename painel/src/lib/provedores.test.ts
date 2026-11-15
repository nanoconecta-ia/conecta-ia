import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherInicial, escolherPersistido, erroAssistente, type OpcaoProvedor } from './provedores.ts';
test('seletor só inicia com opção disponível', () => {
  const base: OpcaoProvedor = { id: 'claude', nome: 'Claude', modelo: null, estado: 'indisponivel', motivo: '', principal: true };
  assert.equal(escolherInicial([base]), '');
  assert.equal(escolherInicial([base, { ...base, id: 'gemini', estado: 'disponivel', principal: false }]), 'gemini');
});
test('mensagens de erro seguras preservam orientação do backend', async () => {
  assert.equal(await erroAssistente({ context: Response.json({ erro: 'Provedor não configurado.' }) }), 'Provedor não configurado.');
  assert.match(await erroAssistente({}), /outro provedor/);
});


test('falha estruturada preserva categoria, origem e request_id do servidor', async () => {
  const { falhaAssistente } = await import('./provedores.ts');
  const { deveRecuperarSemIa } = await import('./recuperacaoSemIa.ts');
  const erro = await falhaAssistente({ context: Response.json({ resposta: 'Falha 429', categoria_erro: 'limite', origem_erro: 'provedor', request_id: 'req_teste' }) });
  assert.equal(erro.message, 'Falha 429');
  assert.equal(deveRecuperarSemIa(erro), true);
  assert.equal((erro as Error & { request_id: string }).request_id, 'req_teste');
});

test('prioridade do QR escolhido permanece após recarregar, mesmo que OpenRouter seja principal', () => {
  const principal: OpcaoProvedor = { id: 'openrouter_free', nome: 'OpenRouter', modelo: null, estado: 'disponivel', motivo: '', principal: true };
  assert.equal(escolherPersistido([principal], null), 'openrouter_free');
  assert.equal(escolherPersistido([principal], 'agente_qr'), 'agente_qr');
  assert.equal(escolherPersistido([principal], ''), '');
  assert.equal(escolherPersistido([principal], 'openrouter_free'), 'openrouter_free');
});
test('se o provedor persistido desaparece, nunca há troca automática para OpenRouter', () => {
  const principal: OpcaoProvedor = { id: 'openrouter_free', nome: 'OpenRouter', modelo: null, estado: 'disponivel', motivo: '', principal: true };
  assert.equal(escolherPersistido([principal], 'claude'), '');
  assert.equal(escolherPersistido([principal], 'valor_invalidado'), '');
});