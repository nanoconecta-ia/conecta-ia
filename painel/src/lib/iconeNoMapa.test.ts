import assert from "node:assert/strict";
import { test } from "node:test";
import { iconeNoMapa } from "./iconeNoMapa.ts";
import { PECAS, iconeDaCategoria } from "./icones.ts";
import { TAXONOMIA_AUTOPECAS } from "./taxonomiaAutopecas.fixture.ts";

test("o ícone do mapa é EXATAMENTE o da página Taxonomia para as 79 categorias reais", () => {
  assert.equal(TAXONOMIA_AUTOPECAS.length, 79);
  for (const [slug, nome] of TAXONOMIA_AUTOPECAS) {
    const no = iconeNoMapa(`tx:${slug}`, nome, slug);
    assert.equal(no, iconeDaCategoria(slug, nome), `${slug}`);
    assert.ok(PECAS.includes(no!), `${slug}: ícone existe no sprite`);
  }
});

test("categorias de lubrificantes e bomba de óleo seguem a taxonomia (não o desenho do motor/arrefecimento)", () => {
  const por = (slug: string) => iconeNoMapa(`tx:${slug}`, "", slug);
  assert.equal(por("oleos-motor"), "lubrificantes");
  assert.equal(por("oleos-transmissao"), "lubrificantes");
  assert.equal(por("fluidos-freio-arrefecimento"), "lubrificantes");
  assert.equal(por("bomba-oleo"), "motor");
  assert.equal(por("bombas-agua"), "arrefecimento");
  assert.equal(por("velas"), "vela");
});

test("nenhuma categoria real cai no ícone genérico, exceto as sem desenho próprio declaradas", () => {
  const SEM_DESENHO = new Set(["sem-classificacao"]);
  const genericas = TAXONOMIA_AUTOPECAS.filter(([slug, nome]) => iconeDaCategoria(slug, nome) === "todas" && !SEM_DESENHO.has(slug)).map(([s]) => s);
  assert.deepEqual(genericas, [], "categoria real sem ícone: acrescente o slug em icones.ts (uma tabela só)");
});

test("só nós de taxonomia recebem desenho de peça; métricas e pontos de atenção não", () => {
  for (const id of ["catalogo", "atencao", "falta:ncm", "situacao", "publicados", "sem-no"]) assert.equal(iconeNoMapa(id, "Bomba d'água", "bombas-agua"), null, id);
  assert.equal(iconeNoMapa("taxonomia", "Taxonomia"), "todas");
});

test("sem slug, cai no nome (mesma regra da Taxonomia) e nunca devolve ícone inexistente", () => {
  assert.ok(PECAS.includes(iconeNoMapa("tx:x", "Peça não identificada")!));
});
