import { test } from "node:test";
import assert from "node:assert/strict";
import { ehFlash, erroBanner, isoDeLocal, linkEnvioWhatsapp, mensagemParaCliente, nosDoMotor, situacao, validarFormulario } from "./banners.ts";

const agora = new Date("2026-10-20T12:00:00Z");
test("situação: rascunho, agendado, no ar e encerrado", () => {
  assert.equal(situacao({ ativo: false, inicio: "2026-10-01T00:00:00Z", fim: null }, agora), "rascunho");
  assert.equal(situacao({ ativo: true, inicio: "2026-10-25T00:00:00Z", fim: null }, agora), "agendado");
  assert.equal(situacao({ ativo: true, inicio: "2026-10-01T00:00:00Z", fim: null }, agora), "no-ar");
  assert.equal(situacao({ ativo: true, inicio: "2026-10-01T00:00:00Z", fim: "2026-10-19T00:00:00Z" }, agora), "encerrado");
});
test("área Motor: raiz e descendentes; sem raiz não marca nada", () => {
  const nos = [{ id: "m", pai_id: null, slug: "motor" }, { id: "b", pai_id: "m", slug: "bombas" }, { id: "x", pai_id: "b", slug: "bomba-oleo" }, { id: "f", pai_id: null, slug: "freios" }, { id: "p", pai_id: "f", slug: "pastilhas" }];
  assert.deepEqual([...nosDoMotor(nos)].sort(), ["b", "m", "x"]);
  assert.equal(nosDoMotor([{ id: "f", pai_id: null, slug: "freios" }]).size, 0);
});
test("flash: automático só em Motor; manual vale sempre; padrão nunca", () => {
  const motor = new Set(["b"]);
  assert.ok(ehFlash("auto", "b", motor)); assert.ok(!ehFlash("auto", "p", motor)); assert.ok(!ehFlash("auto", null, motor));
  assert.ok(ehFlash("flash", null, motor)); assert.ok(!ehFlash("padrao", "b", motor));
});
test("formulário: produto obrigatório, chamada até 80, fim depois do início", () => {
  const ok = { produto: "p", chamada: "Só hoje", inicio: "2026-10-20T10:00", fim: "2026-10-21T10:00" };
  assert.equal(validarFormulario(ok), null);
  assert.match(validarFormulario({ ...ok, produto: "" })!, /produto/);
  assert.match(validarFormulario({ ...ok, chamada: "x".repeat(81) })!, /80/);
  assert.match(validarFormulario({ ...ok, fim: "2026-10-19T10:00" })!, /depois do início/);
  assert.equal(validarFormulario({ ...ok, inicio: "", fim: "" }), null);
  assert.equal(isoDeLocal("lixo"), null);
});
test("erros do banco viram texto claro", () => {
  assert.match(erroBanner("23514", "máximo de 5 banners ativos por loja"), /5 banners/);
  assert.match(erroBanner("23514", "só produto publicado pode ter banner ativo"), /publicado/);
  assert.match(erroBanner("42501", ""), /lojista/);
  assert.match(erroBanner(undefined, "?"), /Não foi possível/);
});
test("mensagem do vendedor: sem preço digitado e link wa.me sem número", () => {
  const m = mensagemParaCliente("Motor parcial", "CI003696", true);
  assert.ok(m.includes("CI003696") && !/R\$/.test(m));
  assert.ok(linkEnvioWhatsapp(m).startsWith("https://wa.me/?text="));
});
