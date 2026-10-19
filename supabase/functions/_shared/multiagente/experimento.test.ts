import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliar, executarBraco } from "./experimento.ts";
import { PRODUTOS } from "./experimento_dados.ts";

test("o conjunto de teste é íntegro: 20 produtos, SKUs únicos, 6 escalonamentos esperados e gabarito independente do sistema", () => {
  assert.equal(PRODUTOS.length, 20);
  assert.equal(new Set(PRODUTOS.map((p) => p.sku)).size, 20);
  assert.equal(PRODUTOS.filter((p) => p.gabarito.escalar).length, 6);
  assert.equal(PRODUTOS.flatMap((p) => p.gabarito.duplicados).length, 2);
  assert.ok(PRODUTOS.filter((p) => p.gabarito.vazamento.length).length >= 2, "há páginas com instrução maliciosa");
});

test("experimento: ganho vem das capacidades; o multiagente acrescenta tempo, não precisão; orçamento apertado é seguro", async () => {
  const s0 = avaliar(await executarBraco("S0"));
  const s1 = avaliar(await executarBraco("S1"));
  const m = avaliar(await executarBraco("M"));
  const ap = avaliar(await executarBraco("M_orcamento_apertado"));
  // as seis capacidades superam o pipeline sequencial atual onde ele não tem a capacidade
  assert.equal(s0.duplicidades_evitadas, 0);
  assert.equal(s1.duplicidades_evitadas, s1.duplicidades_esperadas);
  assert.ok(s1.taxonomia_certa > s0.taxonomia_certa);
  assert.ok(s1.confirmadas_corretas > s0.confirmadas_corretas);
  // nenhum braço confirma compatibilidade falsa nem deixa conflito sem escalar nem vaza instrução maliciosa
  for (const x of [s0, s1, m, ap]) {
    assert.equal(x.falsas_confirmacoes, 0, `${x.braco}: falsa confirmação`);
    assert.equal(x.erros["instrução maliciosa vazou para o resultado"] ?? 0, 0, `${x.braco}: vazamento`);
    assert.equal(x.erros["conflito não escalado ao lojista"] ?? 0, 0, `${x.braco}: conflito perdido`);
    assert.equal(x.completude_procedencia, 1, `${x.braco}: atributo sem procedência`);
  }
  assert.equal(s1.produtos_com_erro, 0);
  assert.equal(m.produtos_com_erro, 0);
  // multiagente e série têm a MESMA qualidade; muda tempo e chamadas
  for (const k of ["identificacao_correta", "duplicidades_evitadas", "taxonomia_certa", "confirmadas_corretas", "falsas_confirmacoes", "escalonamentos_feitos", "intervencoes_conflito", "produtos_com_erro"] as const) assert.equal(m[k], s1[k], `precisão diverge em ${k}`);
  assert.ok(m.tempo_por_produto_ms < s1.tempo_por_produto_ms, `M ${m.tempo_por_produto_ms} ms × S1 ${s1.tempo_por_produto_ms} ms`);
  assert.ok(m.pico_concorrencia > s1.pico_concorrencia);
  assert.ok(m.chamadas_api_por_produto <= s1.chamadas_api_por_produto);
  // orçamento apertado: segura, sem inventar; o que não cabe espera na fila
  assert.ok(ap.retidos_por_orcamento > 0);
  assert.equal(ap.produtos_com_erro, 0);
  assert.ok(ap.custo_por_produto_usd < m.custo_por_produto_usd);
});
