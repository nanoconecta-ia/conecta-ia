import test from "node:test";
import assert from "node:assert/strict";
import { criarAdaptadorCodeModeLeitura, OPERACOES_CODEMODE_LEITURA, type IdentidadeCodeMode } from "./codemode_bridge.ts";
import type { ContextoDespacho, ResultadoDespacho } from "./despacho.ts";

const loja = "aaaaaaaa-0000-0000-0000-000000000001";
const outraLoja = "bbbbbbbb-0000-0000-0000-000000000002";
const uid = "cccccccc-0000-0000-0000-000000000003";
const identidade: IdentidadeCodeMode = { chave_id: "chave-teste", loja_id: loja, escopos: ["leitura"] };
const base = { lojaId: loja, userId: uid, origem: "gateway_mcp" as const } as ContextoDespacho;
const permitido = (resultado: unknown): ResultadoDespacho => ({ ok: true, decisao: "permitida", resultado });
const resumo = { produtos: 3, publicados: 2, aguardando_aprovacao: 1, precoCusto: 9182, fornecedor: "confidencial", token: "NUNCA" };
let chamadas: { id: string; entrada: unknown; contexto: ContextoDespacho }[] = [];
const mock = async (id: string, entrada: unknown, contexto: ContextoDespacho): Promise<ResultadoDespacho> => {
  chamadas.push({ id, entrada, contexto });
  return permitido(id.endsWith("resumo") ? resumo : [
    { sku: "TEST-A-001", nome: "Peça da loja", marca: "X", ncm: "000", precoCusto: 400, fornecedor: "sigiloso", preco: 900 },
  ]);
};
const novo = (op: Record<string, unknown> = {}) => criarAdaptadorCodeModeLeitura({
  contexto: base, identidade,
  revalidarChave: async () => identidade,
  despacharFn: mock,
  ...op,
});
test.beforeEach(() => { chamadas = []; });

test("contrato expõe somente duas consultas; veda escrita, propostas e ferramentas arbitrárias", async () => {
  const a = novo();
  assert.deepEqual(a.operacoes, ["catalogo_resumo", "catalogo_listar"]);
  assert.deepEqual(OPERACOES_CODEMODE_LEITURA, ["catalogo_resumo", "catalogo_listar"]);
  for (const operacao of ["bling.produtos.alterar", "conecta.proposta.criar", "conecta__proposta__criar", "catalogo_ver", "__proto__"]) {
    await assert.rejects(a.executar(operacao, {}), /operacao_nao_autorizada/);
  }
  assert.equal(chamadas.length, 0);
});

test("saídas são allowlist explícita, sem preço, custo, estoque, NCM, fornecedor ou tokens", async () => {
  const a = novo();
  const res = await a.executar("catalogo_resumo", {});
  assert.deepEqual(res, { produtos: 3, publicados: 2, aguardando_aprovacao: 1, origem: "espelho_auditado" });
  const list = await a.executar("catalogo_listar", { limite: 10 });
  assert.deepEqual(list, { itens: [{ sku: "TEST-A-001", nome: "Peça da loja" }], origem: "espelho_auditado", homologacao_tecnica: "nao_verificada" });
  const txt = JSON.stringify([res, list]).toLowerCase();
  for (const s of ["custo", "fornecedor", "preco", "estoque", "ncm", "sigiloso", "nunca", "token"]) assert.ok(!txt.includes(s), s);
  assert.equal(chamadas.length, 2);
  assert.deepEqual(chamadas.map((x) => x.id), ["conecta.catalogo.resumo", "conecta.catalogo.listar"]);
  for (const c of chamadas) {
    assert.equal(c.contexto.lojaId, loja);
    assert.equal(c.contexto.mcpChaveId, "chave-teste");
    assert.equal(c.contexto.origem, "gateway_mcp");
    assert.deepEqual(c.contexto.escopos, ["leitura"]);
  }
});

test("revogação e escopo são verificados antes de cada operação interna", async () => {
  let habilitada = true;
  const a = novo({ revalidarChave: async () => habilitada ? identidade : null });
  await a.executar("catalogo_resumo", {});
  habilitada = false;
  await assert.rejects(a.executar("catalogo_listar", {}), /chave_revogada_ou_sem_escopo/);
  assert.equal(chamadas.length, 1);
  await assert.rejects(novo({ revalidarChave: async () => ({ ...identidade, escopos: ["propor"] }) }).executar("catalogo_resumo"), /chave_revogada/);
  await assert.rejects(novo({ revalidarChave: async () => ({ ...identidade, chave_id: "outra" }) }).executar("catalogo_resumo"), /chave_revogada/);
});

test("tenant do contexto não é selecionável pela IA, e tem que corresponder ao token revalidado", async () => {
  await assert.rejects(novo({ contexto: { ...base, lojaId: outraLoja } }).executar("catalogo_resumo"), /identidade_invalida/);
  await assert.rejects(novo({ revalidarChave: async () => ({ ...identidade, loja_id: outraLoja }) }).executar("catalogo_resumo"), /chave_revogada/);
  assert.equal(chamadas.length, 0);
});

test("orçamento de chamadas só permite doze operações, inclusive com recusa", async () => {
  const a = novo();
  for (let i = 0; i < 12; i++) await a.executar("catalogo_resumo");
  await assert.rejects(a.executar("catalogo_resumo"), /limite_de_chamadas_internas/);
  assert.equal(chamadas.length, 12);
});

test("requisição oversized, circular e não objeto são recusadas antes do handler", async () => {
  const a = novo();
  await assert.rejects(a.executar("catalogo_listar", { busca: "X".repeat(5000) }), /argumento_invalido/);
  const circular: any = {}; circular.self = circular;
  await assert.rejects(a.executar("catalogo_listar", circular), /argumento_invalido/);
  await assert.rejects(a.executar("catalogo_listar", ["array"]), /argumento_invalido/);
  assert.equal(chamadas.length, 0);
});

test("auditoria ausente, falha do handler ou saída inválida nunca vaza conteúdo", async () => {
  const falhou = novo({ despacharFn: async () => ({
    ok: false, decisao: "permitida", auditoria_falhou: true,
    erro: "auditoria_nao_confirmada", resultado: { fornecedor: "vazamento" },
  }) });
  await assert.rejects(falhou.executar("catalogo_resumo"), /^Error: auditoria_nao_confirmada$/);
  const negou = novo({ despacharFn: async () => ({ ok: false, decisao: "negada", erro: "segredo" }) });
  await assert.rejects(negou.executar("catalogo_resumo"), /^Error: operacao_nao_autorizada_ou_falhou$/);
  const bruto = novo({ despacharFn: async () => permitido({ produtos: 3, publicados: null, aguardando_aprovacao: 0 }) });
  await assert.rejects(bruto.executar("catalogo_resumo"), /resposta_cadastro_invalida/);
});

test("budget temporal corta operação e configuração inválida é recusada", async () => {
  let t = 0;
  const a = novo({ relogio: () => t, prazoMs: 100 });
  await a.executar("catalogo_resumo");
  t = 101;
  await assert.rejects(a.executar("catalogo_listar"), /tempo_total_esgotado/);
  assert.equal(chamadas.length, 1);
  assert.throws(() => novo({ limite: 13 }), /limite_invalido/);
  assert.throws(() => novo({ prazoMs: 13_000 }), /prazo_invalido/);
});

test("despachante REAL conserva validação e auditoria mesmo via ponte de leitura", async () => {
  const auds: string[] = [];
  const contexto = {
    ...base,
    dados: {
      resumo: async () => ({ produtos: 2, publicados: 1, aguardando_aprovacao: 1 }),
      listarProdutos: async () => [{ sku: "A1", nome: "Teste", precoCusto: 999, fornecedor: "privado" }],
    },
    rpc: async (fn: string) => { auds.push(fn); return { data: true, error: null }; },
  } as unknown as ContextoDespacho;
  const a = criarAdaptadorCodeModeLeitura({ contexto, identidade, revalidarChave: async () => identidade });
  assert.deepEqual(await a.executar("catalogo_resumo"), { produtos: 2, publicados: 1, aguardando_aprovacao: 1, origem: "espelho_auditado" });
  assert.deepEqual(await a.executar("catalogo_listar", { limite: 10 }), {
    itens: [{ sku: "A1", nome: "Teste" }], origem: "espelho_auditado", homologacao_tecnica: "nao_verificada",
  });
  await assert.rejects(a.executar("catalogo_listar", { limite: 999 }), /operacao_nao_autorizada_ou_falhou/);
  assert.deepEqual(auds, ["agente_chamada_registrar", "agente_chamada_registrar", "agente_chamada_registrar"]);
});
