import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUNAS_BLING, compararHashes, csvBling, executarBackup, hashProduto, jsonEstavel, linhaBling, numeroBling, type PortasBackup, type ProdutoColetado } from "./bling_snapshot.ts";

const ctx = { categorias: new Map([["14668460", "Motor"]]), fornecedores: new Map([["6994437145", "QUATRO DISTRIBUIDORA DE AUTO PECAS LTDA - EPP"]]) };
const produto = {
  id: 16721657772, codigo: "CI000016", nome: "BOMBA DAGUA TESTE \\12 C/ JUNTAS", unidade: "UN", preco: 176.77, situacao: "A", marca: "TRIM GO", tipoProducao: "P", condicao: 0,
  categoria: { id: 14668460 }, estoque: { saldoVirtualTotal: 0, localizacao: "", maximo: 0, minimo: 0 }, tributacao: { ncm: "8413.30.90", origem: 0 },
  dimensoes: { largura: 0, altura: 0, profundidade: 0, unidadeMedida: 0 }, descricaoCurta: "Bomba \"curta\"", descricaoComplementar: "Texto longo", dataValidade: "0000-00-00",
};
const vinculos = [{ padrao: true, codigo: "CI000016", descricao: "BOMBA DAGUA TESTE - MARCA: TRIM GO", precoCompra: 110.48, precoCusto: 0, fornecedor: { id: 6994437145 } }];

test("a planilha do Bling tem 59 colunas, sem repetição", () => {
  assert.equal(COLUNAS_BLING.length, 59);
  assert.equal(new Set(COLUNAS_BLING).size, 59);
  assert.equal(COLUNAS_BLING[0], "ID"); assert.equal(COLUNAS_BLING[58], "Informações Adicionais");
});

test("números no padrão do Bling: ponto de milhar e vírgula decimal", () => {
  assert.equal(numeroBling(176.77, 6), "176,770000");
  assert.equal(numeroBling(12000, 6), "12.000,000000");
  assert.equal(numeroBling(11663.865439, 6), "11.663,865439");
  assert.equal(numeroBling(undefined, 2), "0,00");
  assert.equal(numeroBling("7500", 6), "7.500,000000");
  assert.equal(numeroBling(0, 0), "0");
  assert.equal(numeroBling(-1234.5, 2), "-1.234,50");
});

test("linha do produto no formato do Bling, com fornecedor e categoria resolvidos", () => {
  const l = linhaBling(produto, vinculos, ctx);
  const c = (nome: (typeof COLUNAS_BLING)[number]) => l[COLUNAS_BLING.indexOf(nome)];
  assert.equal(l.length, 59);
  assert.equal(c("Código"), "CI000016\t");
  assert.equal(c("Cód. no fornecedor"), "\tCI000016");
  assert.equal(c("Situação"), "Ativo"); assert.equal(c("Preço"), "176,770000"); assert.equal(c("NCM"), "8413.30.90");
  assert.equal(c("Fornecedor"), "QUATRO DISTRIBUIDORA DE AUTO PECAS LTDA - EPP");
  assert.equal(c("Preço de Compra"), "110,480000"); assert.equal(c("Categoria do produto"), "Motor");
  assert.equal(c("Tipo Produção"), "Própria"); assert.equal(c("Condição do Produto"), "NÃO ESPECIFICADO");
  assert.equal(c("Unidade de Medida"), "Metros"); assert.equal(c("Frete Grátis"), "NÃO"); assert.equal(c("Data Validade"), "");
  assert.equal(c("Marca"), "TRIM GO");
});

test("produto sem fornecedor nem categoria não quebra: campos vazios e zeros", () => {
  const l = linhaBling({ id: 1, codigo: "X", nome: "Sem vínculo", situacao: "I", tipoProducao: "T" }, [], ctx);
  const c = (nome: (typeof COLUNAS_BLING)[number]) => l[COLUNAS_BLING.indexOf(nome)];
  assert.equal(l.length, 59);
  assert.equal(c("Fornecedor"), ""); assert.equal(c("Categoria do produto"), ""); assert.equal(c("Situação"), "Inativo");
  assert.equal(c("Tipo Produção"), "Terceiros"); assert.equal(c("Preço de Compra"), "0,000000");
});

test("CSV: ponto e vírgula, tudo entre aspas, aspas duplicadas, 59 campos por linha", () => {
  const csv = csvBling([linhaBling(produto, vinculos, ctx)]);
  const linhas = csv.trimEnd().split("\n");
  assert.equal(linhas.length, 2);
  assert.ok(linhas[0].startsWith('"ID";"Código";"Descrição"'));
  assert.ok(linhas[1].includes('"Bomba ""curta"""'));
  assert.ok(csv.endsWith("\n"));
  assert.equal(linhas[1].split('";"').length, 59);
});

test("hash estável: ordem das chaves não muda, conteúdo diferente muda", async () => {
  assert.equal(jsonEstavel({ b: 1, a: [2, { d: 4, c: 3 }] }), jsonEstavel({ a: [2, { c: 3, d: 4 }], b: 1 }));
  const h1 = await hashProduto(produto, vinculos);
  assert.equal(h1, await hashProduto({ ...produto }, [...vinculos]));
  assert.notEqual(h1, await hashProduto({ ...produto, preco: 180 }, vinculos));
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("comparar snapshot com o Bling: novos, alterados e removidos", () => {
  const r = compararHashes(new Map([["1", "a"], ["2", "b"], ["3", "c"]]), new Map([["2", "b"], ["3", "x"], ["4", "d"]]));
  assert.deepEqual(r, { novos: ["4"], alterados: ["3"], removidos: ["1"] });
});

function portasFalsas(over: Partial<PortasBackup> = {}) {
  const gravados: { produtos: ProdutoColetado[]; categorias: unknown[]; contatos: unknown[] }[] = [];
  const log = { concluido: [] as [string, string | undefined][], podou: 0, leituras: 0 };
  let t = 0;
  const p: PortasBackup = {
    async listarProdutos(situacao, pagina) { log.leituras++; return pagina > 1 ? { itens: [] } : { itens: situacao === "ativos" ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }] }; },
    async detalhe(id) { log.leituras++; return { id, codigo: `C${id}`, nome: `P${id}`, preco: id }; },
    async vinculos(id) { log.leituras++; return id === 1 ? [{ padrao: true, fornecedor: { id: 90 }, precoCompra: 5 }] : []; },
    async categorias() { log.leituras++; return { itens: [{ id: 10, descricao: "Motor" }, { id: 11, descricao: "Bielas", categoriaPai: { id: 10 } }] }; },
    async contato(id) { log.leituras++; return { id, nome: "Fornecedor X", numeroDocumento: "11111111000111" }; },
    async iniciar() { return "snap-1"; },
    async gravar(_s, lote) { gravados.push(lote); },
    async concluir(_s, st, erro) { log.concluido.push([st, erro]); },
    async podar() { log.podou++; },
    async espera() { t += 1; },
    agora: () => t,
    ...over,
  };
  return { p, gravados, log };
}

test("backup completo: categorias, ativos e inativos, vínculos e contatos; poda no fim", async () => {
  const { p, gravados, log } = portasFalsas();
  const r = await executarBackup("manual", p);
  assert.equal(r.status, "completo");
  assert.deepEqual([r.produtos, r.categorias, r.contatos], [3, 2, 1]);
  assert.deepEqual(log.concluido, [["completo", undefined]]);
  assert.equal(log.podou, 1);
  const prods = gravados.flatMap((g) => g.produtos);
  assert.deepEqual(prods.map((x) => x.bling_id).sort(), ["1", "2", "3"]);
  assert.equal(prods.find((x) => x.bling_id === "1")!.json_vinculos.length, 1);
  assert.match(prods[0].hash, /^[0-9a-f]{64}$/);
  assert.equal(gravados.flatMap((g) => g.categorias as { pai_bling_id: string | null }[]).find((c) => c.pai_bling_id === "10") !== undefined, true);
});

test("falha ao listar categorias: status falhou, nada de produto gravado, sem poda", async () => {
  const { p, gravados, log } = portasFalsas({ categorias: async () => ({ erro: "Bling respondeu 401" }) });
  const r = await executarBackup("diario", p);
  assert.equal(r.status, "falhou"); assert.equal(r.erro, "Bling respondeu 401");
  assert.deepEqual(log.concluido, [["falhou", "Bling respondeu 401"]]);
  assert.equal(gravados.flatMap((g) => g.produtos).length, 0);
  assert.equal(log.podou, 0);
});

test("tempo esgotado no meio: fica parcial, guarda o que já coletou e não poda", async () => {
  let t = 0;
  const { p, gravados, log } = portasFalsas({ espera: async () => { t += 50; }, agora: () => t });
  const r = await executarBackup("manual", p, 250);
  assert.equal(r.status, "parcial");
  assert.equal(log.concluido[0][0], "parcial");
  assert.ok(gravados.flatMap((g) => g.produtos).length < 3);
  assert.equal(log.podou, 0);
});

test("detalhe indisponível: parcial, com o que já foi lido guardado", async () => {
  const { p, gravados, log } = portasFalsas({ detalhe: async (id) => (id === 2 ? null : { id, codigo: `C${id}` }) });
  const r = await executarBackup("manual", p);
  assert.equal(r.status, "parcial");
  assert.match(r.erro ?? "", /produto 2/);
  assert.deepEqual(gravados.flatMap((g) => g.produtos).map((x) => x.bling_id), ["1"]);
  assert.equal(log.concluido[0][0], "parcial");
});

test("exceção inesperada nunca escapa: vira resultado falhou", async () => {
  const { p } = portasFalsas({ listarProdutos: async () => { throw new Error("rede caiu"); } });
  const r = await executarBackup("manual", p);
  assert.equal(r.status, "falhou"); assert.equal(r.erro, "rede caiu");
});
