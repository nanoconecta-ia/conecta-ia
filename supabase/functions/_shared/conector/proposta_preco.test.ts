// O Nano (chat e MCP) passa a PROPOR a troca de PREÇO DE VENDA de produto ativo. Só proposta: nada é gravado no Bling, a execução real do preço não
// é suportada, custo/margem/fornecedor/fiscal nunca entram e o preço atual é conferido no Bling na hora (diverge => nada é proposto).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FERRAMENTAS, SISTEMA, executarFerramenta } from "../ia/ferramentas.ts";
import { FERRAMENTAS_PROPOSTA_BLING } from "../assistente/chat.ts";
import { FERRAMENTAS_FREE } from "../assistente/free_automatico.ts";
import { ALIASES_ASSISTENTE } from "./aliases.ts";
import { buscarDefinicao } from "./registro.ts";
import { BlingMock } from "./bling_mock.ts";
import { CAMPOS_ESCRITA_LIBERADOS } from "./bling_campos.ts";
import { escreverEConfirmarNoBling, type ItemExecucao } from "./executor.ts";
import { buscarFerramenta } from "../bling_ferramentas.ts";
import { adminFake } from "./cadastro_novo.test.ts";

const nome = "bling_propor_alterar_preco";
type Esp = { situacao?: string; preco?: unknown; bling_id?: string | null } | null;
function contexto(bling: BlingMock, esp: Esp = { situacao: "A", preco: "48.000000", bling_id: "701" }) {
  const itens: Record<string, unknown>[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (fn === "agente_proposta_item_adicionar") itens.push(args);
    const dados: Record<string, unknown> = { agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } };
    return { data: dados[fn] ?? null, error: null };
  };
  const dados = {
    verProduto: async () => (esp ? { sku: "OC1224", nome: "FILTRO", preco: esp.preco, situacao: esp.situacao ?? "A" } : { erro: "Produto não encontrado nesta loja." }),
    produtoPorSku: async () => (esp ? { id: "uuid-1", bling_id: esp.bling_id, sku: "OC1224", nome: "FILTRO", publicado: false } : null),
  };
  const conector = { origem: "chat" as const, lojaId: "L", userId: "u1", bling, rpc, dados, admin: adminFake(), agente: { nome: "Nano.ia", provedor: "gemini", modelo: "x" } } as any;
  return { itens, ctx: { usuario: null, admin: null, lojaId: "L", plugins: [], credencial: async () => null, conector, buscaImagem: null, searxng: null } as any };
}
const blingCom = (preco: number) => new BlingMock().semear("701", { codigo: "OC1224", nome: "FILTRO", preco, situacao: "A" });
const entrada = { sku: "OC1224", preco_novo: 55, motivo: "Ajuste da tabela de venda do mês" };

test("a ferramenta existe no chat, mapeia para o registro, é ativa no chat e no MCP e o gratuito NÃO a recebe", () => {
  assert.ok(FERRAMENTAS.some((f) => f.name === nome)); assert.equal(ALIASES_ASSISTENTE[nome], "bling.produtos.preparar_alteracao_preco");
  assert.ok((FERRAMENTAS_PROPOSTA_BLING as readonly string[]).includes(nome));
  const d = buscarDefinicao("bling.produtos.preparar_alteracao_preco")!;
  assert.equal(d.permissao, "propor"); assert.equal(d.estado, "ativa"); assert.equal(d.risco, "MEDIUM"); assert.deepEqual(d.exposicao, { chat: true, mcp: true });
  assert.ok(!(FERRAMENTAS_FREE as readonly string[]).includes(nome), "o modelo gratuito só consulta");
  const f = FERRAMENTAS.find((x) => x.name === nome)!;
  assert.deepEqual((f.input_schema as { required: string[] }).required, ["sku", "preco_novo", "motivo"]);
  assert.equal((f.input_schema as { additionalProperties: boolean }).additionalProperties, false);
});

test("o prompt oferece a proposta de preço e explica a recusa de custo pelo motivo certo (política), sem prometer custo/estoque/fiscal", () => {
  assert.match(SISTEMA, /ALTERAR O PREÇO DE VENDA de produto ativo \(bling_propor_alterar_preco/);
  assert.match(SISTEMA, /Ainda NÃO existe ferramenta para alterar custo, estoque, fornecedor ou dados fiscais/);
  assert.match(SISTEMA, /NÃO são compartilhados com o agente, por política/);
  assert.doesNotMatch(SISTEMA, /Ainda NÃO existe ferramenta para alterar preço de produto existente/);
});

test("propõe o preço: antes do espelho, depois novo, diferença do servidor, alvo = id do Bling; NADA é enviado ao Bling", async () => {
  const b = blingCom(48); const { ctx, itens } = contexto(b);
  const r = await executarFerramenta(nome, entrada, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.equal(itens.length, 1);
  const it = itens[0];
  assert.equal(it.p_operacao, "bling.produtos.alterar_preco"); assert.equal(it.p_alvo, "701");
  assert.deepEqual(it.p_antes, { preco_venda: 48 }); assert.deepEqual(it.p_depois, { preco_venda: 55 }); assert.deepEqual(it.p_campos, ["preco_venda"]);
  assert.equal(it.p_risco, "MEDIUM");
  assert.ok((it.p_validacoes as string[]).some((v) => /R\$ 7,00 \(14\.58%\)/.test(v)), JSON.stringify(it.p_validacoes));
  assert.ok((it.p_fontes as { documento: string }[])[0].documento.includes("Ajuste da tabela de venda do mês"));
  assert.equal(b.recebidos.length, 0, "propor não escreve no Bling");
});

test("recusas: custo/margem/fornecedor no motivo, campo extra, preço igual, inválido, produto inexistente ou inativo, sem id do Bling", async () => {
  const casos: [string, Record<string, unknown>, Esp | undefined][] = [
    ["motivo com custo", { ...entrada, motivo: "Subir porque o custo do fornecedor aumentou" }, undefined],
    ["motivo com margem", { ...entrada, motivo: "Manter a margem de 30 por cento" }, undefined],
    ["campo extra", { ...entrada, custo: 10 }, undefined],
    ["preço igual", { ...entrada, preco_novo: 48 }, undefined],
    ["preço zero", { ...entrada, preco_novo: 0 }, undefined],
    ["três casas", { ...entrada, preco_novo: 55.123 }, undefined],
    ["variação absurda", { ...entrada, preco_novo: 9999 }, undefined],
    ["produto inexistente", entrada, null],
    ["produto inativo", entrada, { situacao: "E", preco: "48", bling_id: "701" }],
    ["sem id do Bling", entrada, { situacao: "A", preco: "48", bling_id: null }],
    ["sem preço no espelho", entrada, { situacao: "A", preco: null, bling_id: "701" }],
  ];
  for (const [rotulo, e, esp] of casos) {
    const b = blingCom(48); const { ctx, itens } = contexto(b, esp === undefined ? undefined : esp);
    const r = await executarFerramenta(nome, e, ctx) as any;
    assert.ok(!r.proposta_id, rotulo); assert.equal(itens.length, 0, rotulo); assert.equal(b.recebidos.length, 0, rotulo);
  }
});

test("o preço do Bling é conferido AGORA: se diverge do espelho, nada é proposto e o aviso diz os dois valores", async () => {
  const b = blingCom(52.9); const { ctx, itens } = contexto(b);
  const r = await executarFerramenta(nome, entrada, ctx) as any;
  assert.ok(!r.proposta_id); assert.equal(itens.length, 0);
  const texto = JSON.stringify(r); assert.match(texto, /52,90|52\.90/); assert.match(texto, /48,00|48\.00/); assert.match(texto, /desatualizado/);
});

test("falha FECHADO: Bling indisponível, sem leitura ou sem preço no retorno => nada proposto", async () => {
  for (const modo of ["503", "sem_preco", "sem_bling"] as const) {
    const b = blingCom(48);
    const bling = modo === "503" ? ({ ...b, simulado: true, ler: async () => ({ status: 503 }) } as any)
      : modo === "sem_preco" ? ({ ...b, simulado: true, ler: async () => ({ status: 200, corpo: { data: { id: 701 } } }) } as any) : undefined;
    const { ctx, itens } = contexto(bling as any);
    const r = await executarFerramenta(nome, entrada, ctx) as any;
    assert.ok(!r.proposta_id, modo); assert.equal(itens.length, 0, modo);
  }
});

test("a execução real do preço NÃO é suportada: o executor recusa, a lista de campos liberados não tem preço e a ferramenta Bling está desligada", async () => {
  const b = blingCom(48);
  const item: ItemExecucao = { item_id: "i1", produto_id: "uuid-1", operacao: "bling.produtos.alterar_preco", alvo: "701", campos: ["preco_venda"], antes: { preco_venda: 48 }, depois: { preco_venda: 55 }, idempotency_key: "k" };
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar_preco", item, undefined, { ...CAMPOS_ESCRITA_LIBERADOS, "bling.produtos.alterar_preco": ["preco_venda"] });
  assert.equal(v.estado, "falhou"); assert.match(String(v.motivo), /operacao_nao_suportada/); assert.equal(b.recebidos.length, 0);
  assert.equal(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.alterar_preco"], undefined);
  assert.equal(buscarFerramenta("bling.produtos.alterar_preco")!.ativa, false);
  assert.notEqual(buscarDefinicao("bling.produtos.alterar_preco")!.estado, "ativa", "o registro não a deixa ativa");
});
