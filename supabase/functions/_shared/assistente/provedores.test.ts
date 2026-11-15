import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarProvedores, nomeProvedor, validarProvedor, type ChavePublica } from './provedores.ts';
const k: ChavePublica = { provedor: 'compativel_openai', ativa: true, principal: true, modelo: 'gpt-exemplo', base_url: 'https://api.openai.com/v1', limite_mensal_tokens: 10, tokens_mes: 10, mes_ref: '2026-10-01' };
test('estados, mês novo e configuração incompleta', () => {
  assert.equal(listarProvedores([], false)[0].estado, 'nao_configurado');
  assert.equal(listarProvedores([k], false, new Date('2026-10-18'))[0].estado, 'indisponivel');
  assert.equal(listarProvedores([k], false, new Date('2026-11-01'))[0].estado, 'disponivel');
  assert.equal(listarProvedores([{ ...k, modelo: null }])[0].estado, 'indisponivel');
  assert.equal(listarProvedores([{ ...k, ativa: false }])[0].estado, 'nao_configurado');
});
test('somente a API OpenAI é rotulada GPT', () => {
  assert.equal(nomeProvedor('compativel_openai', k.base_url), 'GPT');
  for (const base of ['https://api.openai.com.evil.invalid/v1', 'https://api.openai.com/outro', 'https://outro.invalid/v1']) assert.notEqual(nomeProvedor('compativel_openai', base), 'GPT');
});
test('enum fechado rejeita null, array, vazio e ids arbitrários', () => {
  for (const v of [null, [], {}, '', '__proto__']) assert.throws(() => validarProvedor(v));
  assert.equal(validarProvedor(undefined), undefined); assert.equal(validarProvedor('gemini'), 'gemini'); assert.equal(validarProvedor('openai'), 'openai');
});

test('GPT oficial é separado do Groq e só fica disponível com configuração própria', () => {
  const lista = listarProvedores([{ ...k, provedor: 'openai', modelo: 'gpt-6-luna', base_url: null, limite_mensal_tokens: 1000, tokens_mes: 0 }], false, new Date('2026-11-15'));
  assert.equal(lista.find(p => p.id === 'openai')?.nome, 'GPT (OpenAI oficial)');
  assert.equal(lista.find(p => p.id === 'openai')?.estado, 'disponivel');
  assert.equal(lista.find(p => p.id === 'compativel_openai')?.estado, 'nao_configurado');
  assert.equal(listarProvedores([{ ...k, provedor: 'openai', base_url: 'https://api.groq.com/openai/v1' }]).find(p => p.id === 'openai')?.estado, 'indisponivel');
});
