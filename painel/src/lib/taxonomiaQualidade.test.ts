import { test } from "node:test";
import assert from "node:assert/strict";
import { auditarArvore, type NoTaxonomiaCompleto } from "./taxonomiaQualidade.ts";
const no = (id: string, pai_id: string | null, slug: string, nome = slug): NoTaxonomiaCompleto => ({ id, pai_id, slug, nome, status: "proposto" });
test("árvore válida não gera alertas", () => {
  assert.deepEqual(auditarArvore([no("raiz", null, "motor"), no("filho", "raiz", "d4cb")]), { orfaos: [], ciclos: [], duplicados: [], semNome: [] });
});
test("detecta nó órfão, ciclo e duplicata entre irmãos sem mudar categorias", () => {
  const r = auditarArvore([no("a", "b", "a"), no("b", "a", "b"), no("x", "inexistente", "motor"), no("y", "inexistente", "motor"), no("z", null, "", "")]);
  assert.deepEqual(r.orfaos, ["x", "y"]);
  assert.deepEqual(r.ciclos, ["a", "b"]);
  assert.deepEqual(r.duplicados, ["y"]);
  assert.deepEqual(r.semNome, ["z"]);
});
test("nomes iguais em pais diferentes não geram falso duplicado", () => {
  assert.deepEqual(auditarArvore([no("a", null, "a"), no("b", null, "b"), no("c", "a", "bomba"), no("d", "b", "bomba")]).duplicados, []);
});
