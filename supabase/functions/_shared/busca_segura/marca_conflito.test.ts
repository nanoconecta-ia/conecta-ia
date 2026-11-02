// Teste de aceite 4 do PR #242: marca conflitante com o cadastro do Bling -> o AGENTE não troca sozinho (bloqueia e mostra evidência); uma PESSOA pode, registrado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDLERS } from "../conector/handlers.ts";
import type { PortaBling } from "../conector/porta_bling.ts";
import type { Rpc } from "../conector/executor.ts";

const ID = "16719530080";
function bling(marcaNoBling: string, extra: Record<string, unknown> = {}): PortaBling {
  return { simulado: true, async chamar() { throw new Error("propor não escreve"); }, async ler(f: string, a: { id?: string }) {
    if (f === "bling.produtos.consultar") return { status: 200, corpo: { data: [{ id: Number(ID), codigo: "CI001086", nome: "BOMBA OLEO HR", situacao: "A" }] } };
    if (f === "bling.produtos.confirmar" && a.id === ID) return { status: 200, corpo: { data: { id: Number(ID), codigo: "CI001086", nome: "BOMBA OLEO HR - MARCA: TRIM GO", situacao: "A", marca: marcaNoBling, ...extra } } };
    return { status: 404 };
  } } as PortaBling;
}
function contexto(b: PortaBling, agente: { nome: string; provedor?: string }) {
  const itens: Record<string, unknown>[] = [];
  const rpc: Rpc = async (fn, args) => { if (fn === "agente_proposta_item_adicionar") itens.push(args);
    return { data: ({ agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } } as Record<string, unknown>)[fn] ?? null, error: null }; };
  return { ctx: { lojaId: "L", userId: "u1", bling: b, rpc, dados: { produtoPorSku: async () => ({ id: "prod-1" }) }, agente: agente } as any, itens };
}
const URL_F = [{ url: "https://www.sabo.com.br/catalogo/x" }];

test("aceite 4: o modelo propõe marca DIFERENTE com prova FRACA (só declarada no cadastro) -> bloqueado, sem proposta, com a evidência à vista", async () => {
  const { ctx, itens } = contexto(bling(" MARCA: TRIM GO", { descricaoComplementar: "Compatível com junta Sabó" }), { nome: "Nano.ia", provedor: "gemini" });
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: [{ documento: "Cadastro do Bling" }] }, ctx) as any;
  assert.equal(r.erro, "Marca conflitante com o cadastro do Bling"); assert.equal(itens.length, 0);
  assert.equal(r.evidencia.marca_atual_no_bling, "TRIM GO"); assert.equal(r.evidencia.marca_proposta, "Sabó");
  assert.equal(r.evidencia.tipo_da_evidencia, "declarada_no_cadastro"); assert.equal(r.evidencia.verificada, false);
});
test("aceite 4: com URL externa o modelo PODE propor a troca, e a proposta carrega 'TROCA DE MARCA' com a evidência (a pessoa aprova)", async () => {
  const { ctx, itens } = contexto(bling(" MARCA: TRIM GO"), { nome: "Nano.ia", provedor: "gemini" });
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.ok((itens[0].p_validacoes as string[]).some((v) => /TROCA DE MARCA: de "TRIM GO" para "Sabó".*url_externa/.test(v)));
});
test("aceite 4: a PESSOA (formulário, sem IA) pode trocar, e a proposta registra 'TROCA DE MARCA'", async () => {
  const { ctx, itens } = contexto(bling(" MARCA: TRIM GO"), { nome: "Nano.ia (sem IA)", provedor: "nenhum" });
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.ok((itens[0].p_validacoes as string[]).some((v) => /TROCA DE MARCA: de "TRIM GO" para "Sabó"/.test(v)));
});
test("a MESMA marca com outra grafia não é conflito para o modelo (caso CI001086: remover o prefixo 'MARCA:')", async () => {
  const { ctx, itens } = contexto(bling(" MARCA: TRIM GO"), { nome: "Nano.ia", provedor: "gemini" });
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "TRIM GO" }, fontes: [{ documento: "Cadastro do Bling" }] }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r)); assert.equal(itens.length, 1);
});
test("Bling sem marca: o modelo pode propor (com evidência); não há o que conflitar", async () => {
  const { ctx } = contexto(bling(""), { nome: "Nano.ia", provedor: "gemini" });
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
});
