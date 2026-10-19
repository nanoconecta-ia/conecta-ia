import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherInicial, erroAssistente, type OpcaoProvedor } from './provedores.ts';
test('seletor só inicia com opção disponível', () => {
  const base: OpcaoProvedor = { id: 'claude', nome: 'Claude', modelo: null, estado: 'indisponivel', motivo: '', principal: true };
  assert.equal(escolherInicial([base]), '');
  assert.equal(escolherInicial([base, { ...base, id: 'gemini', estado: 'disponivel', principal: false }]), 'gemini');
});
test('mensagens de erro seguras preservam orientação do backend', async () => {
  assert.equal(await erroAssistente({ context: Response.json({ erro: 'Provedor não configurado.' }) }), 'Provedor não configurado.');
  assert.match(await erroAssistente({}), /outro provedor/);
});
