// Fase 3: plano de preenchimento com valores já aprovados. Puro (o preenchimento no DOM é coberto pelo teste visual).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerCampos, type CampoBruto } from "../src/leitura.ts";
import { reconhecer } from "../src/reconhecer.ts";
import { MAPA_PRODUTO_BLING } from "../src/mapa-produto.ts";
import { conferido, planejarPreenchimento } from "../src/preenchimento.ts";

const c = (rotulo: string, valor = "", tipo = "text"): CampoBruto => ({ rotulo, tipo, valor, visivel: true });
const r = reconhecer(lerCampos([c("Nome", "Bomba d'água HR 2.5"), c("Código (SKU)", "CI000016"), c("GTIN/EAN"), c("Marca", "TRIM GO"), c("Descrição curta", "Bomba"), c("Peso líquido (kg)"), c("Categoria", "Arrefecimento", "select"), c("Preço", "100")]), MAPA_PRODUTO_BLING);
const ap = (campo: string, valor: string, id = campo) => ({ id, campo, valor, fonte: "https://fab.exemplo", aprovado_em: "2026-10-30T12:00:00Z" });

test("plano: vazio -> preencher; diferente -> substituir (exige OK); igual -> nada; mapeia campo aprovado -> campo da tela", () => {
  const p = planejarPreenchimento(r, [ap("ean", "7891234567895"), ap("marca_peca", "TRIM GO"), ap("descricao_curta", "Bomba d'água com juntas"), ap("peso_kg", "1.35")]);
  const por = Object.fromEntries(p.map((i) => [i.canonico, i]));
  assert.equal(por.gtin.acao, "preencher");
  assert.equal(por.marca.acao, "igual");
  assert.equal(por.descricaoCurta.acao, "substituir"); assert.equal(por.descricaoCurta.atual, "Bomba");
  assert.equal(por.pesoLiquido.acao, "preencher");
  assert.equal(por.gtin.alvo.rotulo, "GTIN/EAN");
});

test("plano: fiscal (ncm_sugerido) e campos desconhecidos nunca entram; só o mais recente por campo; preço nunca", () => {
  const p = planejarPreenchimento(r, [ap("ncm_sugerido", "8413.30.90"), ap("preco", "99"), ap("marca_peca", "A", "1"), ap("marca_peca", "B", "2")]);
  assert.deepEqual(p.map((i) => i.canonico), ["marca"]);
  assert.equal(p[0].novo, "A", "o primeiro da lista (servidor já manda o mais recente primeiro)");
});

test("plano: tela não reconhecida -> nada; campo ausente na tela -> bloqueado com motivo", () => {
  assert.deepEqual(planejarPreenchimento(reconhecer(lerCampos([c("E-mail", "x")]), MAPA_PRODUTO_BLING), [ap("marca_peca", "X")]), []);
  const semCategoria = reconhecer(lerCampos([c("Nome", "x"), c("Código", "1"), c("Marca", "m"), c("GTIN/EAN", "1")]), MAPA_PRODUTO_BLING);
  const p = planejarPreenchimento(semCategoria, [ap("categoria_sugerida", "Freios")]);
  assert.equal(p[0].acao, "bloqueado"); assert.match(p[0].motivo!, /não encontrado/);
});

test("conferência: compara o valor que ficou na tela com o aprovado", () => {
  assert.equal(conferido(" 1.35 ", "1.35"), true);
  assert.equal(conferido("1,35", "1.35"), false);
});
