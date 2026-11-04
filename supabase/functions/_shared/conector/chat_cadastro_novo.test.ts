// O chat do Nano (LLM) passa a PROPOR produto novo no Bling. Só proposta: nada é gravado, a escrita real de criação segue desligada,
// duplicidade e regras (marca com fonte, sem custo/fiscal) continuam valendo, e o gratuito/externo não ganha escrita.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FERRAMENTAS, SISTEMA, executarFerramenta } from "../ia/ferramentas.ts";
import { FERRAMENTAS_PROPOSTA_BLING } from "../assistente/chat.ts";
import { ALIASES_ASSISTENTE } from "./aliases.ts";
import { buscarDefinicao } from "./registro.ts";
import { BlingMock } from "./bling_mock.ts";
import { CAMPOS_ESCRITA_LIBERADOS } from "./bling_campos.ts";
import { adminFake } from "./cadastro_novo.test.ts";

const nome = "bling_propor_cadastro_produto";
function contexto(bling: BlingMock) {
  const itens: Record<string, unknown>[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (fn === "agente_proposta_item_adicionar") itens.push(args);
    const dados: Record<string, unknown> = { agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } };
    return { data: dados[fn] ?? null, error: null };
  };
  const conector = { origem: "chat" as const, lojaId: "L", userId: "u1", bling, rpc, dados: { produtoPorSku: async () => null }, admin: adminFake(), agente: { nome: "Nano.ia", provedor: "gemini", modelo: "x" } } as any;
  return { itens, ctx: { usuario: null, admin: null, lojaId: "L", plugins: [], credencial: async () => null, conector, buscaImagem: null, searxng: null } as any };
}

test("a ferramenta existe no chat, mapeia para o registro (preparar_cadastro) e é permitida no fluxo persistente", () => {
  assert.ok(FERRAMENTAS.some((f) => f.name === nome)); assert.equal(ALIASES_ASSISTENTE[nome], "bling.produtos.preparar_cadastro");
  assert.ok((FERRAMENTAS_PROPOSTA_BLING as readonly string[]).includes(nome));
  const d = buscarDefinicao("bling.produtos.preparar_cadastro")!; assert.equal(d.permissao, "propor"); assert.equal(d.estado, "ativa");
  const f = FERRAMENTAS.find((x) => x.name === nome)!;
  assert.deepEqual((f.input_schema as { required: string[] }).required, ["rascunho", "fonte"]);
  assert.match(f.description, /Nunca custo, fornecedor, estoque nem dado fiscal/); assert.match(f.description, /Não grava/);
});
test("o Nano deixa de dizer que não cria produto novo e continua sem prometer preço/custo/estoque/fiscal", () => {
  const texto = SISTEMA;
  assert.match(texto, /CADASTRAR produto novo \(bling_propor_cadastro_produto/);
  assert.doesNotMatch(texto, /Ainda NÃO existe ferramenta para criar produto novo/);
  assert.match(texto, /ALTERAR O PREÇO DE VENDA de produto ativo \(bling_propor_alterar_preco/);
  assert.match(texto, /Ainda NÃO existe ferramenta para alterar custo, estoque, fornecedor ou dados fiscais/);
  assert.match(texto, /NÃO são compartilhados com o agente, por política/);
});
test("propõe produto novo pelo chat: proposta criada, NADA gravado no Bling, operação de criação sem campo liberado", async () => {
  const b = new BlingMock(); const { ctx, itens } = contexto(b);
  const r = await executarFerramenta(nome, { rascunho: { nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó", gtin: "7891000100103", preco_venda: 899.9 }, fonte: "https://www.sabo.com.br/catalogo/bomba-oleo" }, ctx) as Record<string, any>;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r)); assert.equal(b.recebidos.length, 0, "propor não escreve no Bling");
  assert.equal(itens[0].p_operacao, "bling.produtos.criar"); assert.deepEqual(itens[0].p_antes, {});
  assert.equal(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.criar"], undefined, "a criação real segue desligada: só o dono liga");
  assert.match(String((itens[0].p_depois as Record<string, unknown>).codigo), /^CI\d{6}$/, "sem código, o sistema propõe SKU CI + 6 dígitos");
});
test("sem fonte não propõe; custo/fornecedor/fiscal são recusados; marca sem URL externa é recusada", async () => {
  const b = new BlingMock(); const { ctx } = contexto(b);
  const semFonte = await executarFerramenta(nome, { rascunho: { nome: "Bomba de óleo HR 2.5 16V" } }, ctx) as Record<string, any>;
  assert.match(String(semFonte.erro), /fonte/i);
  const privado = await executarFerramenta(nome, { rascunho: { nome: "Bomba de óleo HR 2.5 16V", custo: 10, ncm: "84133010" }, fonte: "Pedido do lojista" }, ctx) as Record<string, any>;
  assert.ok(privado.erro, JSON.stringify(privado)); assert.match(JSON.stringify(privado.detalhes ?? privado), /custo|fiscal/i);
  const marca = await executarFerramenta(nome, { rascunho: { nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó" }, fonte: "Pedido do lojista" }, ctx) as Record<string, any>;
  assert.ok(marca.erro, "marca exige fonte URL externa"); assert.equal(b.recebidos.length, 0);
});
test("duplicidade no Bling bloqueia a proposta", async () => {
  const b = new BlingMock().semear("9", { codigo: "CI001087", nome: "Já existe", situacao: "A" });
  const { ctx, itens } = contexto(b);
  const r = await executarFerramenta(nome, { rascunho: { codigo: "CI001087", nome: "Bomba de óleo HR 2.5 16V" }, fonte: "Pedido do lojista" }, ctx) as Record<string, any>;
  assert.equal(r.proposta_id, undefined); assert.equal(itens.length, 0); assert.equal(b.recebidos.length, 0);
});
