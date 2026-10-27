import { test } from "node:test";
import assert from "node:assert/strict";
import { FERRAMENTAS_CONECTOR, buscarDefinicao, ferramentasVisiveis, nomeParaLlm, idDoNomeLlm, CAMPOS_BLING_PERMITIDOS, CAMPOS_BLING_PROIBIDOS } from "./registro.ts";
import { decidir } from "./policy.ts";
import { validar } from "./schema.ts";
import { gerarToken, pareceTokenMcp, sha256Hex } from "./cripto.ts";

const d = (id: string) => buscarDefinicao(id)!;

test("registro: ids únicos, formato aceito pelo banco e contrato completo em toda ferramenta", () => {
  const ids = new Set<string>();
  for (const f of FERRAMENTAS_CONECTOR) {
    assert.match(f.id, /^[a-z_]+(\.[a-z_]+)+$/, f.id);
    assert.ok(!ids.has(f.id), `duplicada: ${f.id}`); ids.add(f.id);
    for (const campo of ["descricao", "verificacao", "recuperacao"] as const) assert.ok(f[campo].length > 5, `${f.id}.${campo}`);
    assert.ok(f.entrada && f.saida, f.id);
    if (f.permissao === "executar") {
      assert.equal(f.exigeAprovacao, true, `${f.id} exige aprovação`);
      assert.equal(f.idempotencia, "chave", `${f.id} exige idempotência`);
      assert.equal(f.exposicao.chat || f.exposicao.mcp, false, `${f.id} nunca exposta a LLM/cliente`);
      // escrita em sistema externo (Bling) nasce desligada; execução interna aprovada pode estar ativa
      assert.equal(f.estado, f.escreveExterno ? "desligada" : "ativa", `${f.id} estado inicial`);
    }
    if (f.escreveExterno) assert.equal(f.permissao, "executar", `${f.id}: escrita externa só no executor`);
  }
});

test("registro: lista visível ao LLM só tem ferramentas ativas, nunca execução; MCP respeita o escopo", () => {
  const chat = ferramentasVisiveis("chat");
  assert.ok(chat.length > 5);
  assert.ok(chat.every((f) => f.estado === "ativa" && f.permissao !== "executar"));
  assert.ok(!chat.some((f) => f.id.startsWith("bling.produtos.alterar")));
  const soLeitura = ferramentasVisiveis("gateway_mcp", ["leitura"]);
  assert.ok(soLeitura.length > 0 && soLeitura.every((f) => f.permissao === "leitura" && f.exposicao.mcp));
  const comPropor = ferramentasVisiveis("gateway_mcp", ["leitura", "propor"]);
  assert.ok(comPropor.some((f) => f.id === "conecta.proposta.criar"));
  assert.ok(!soLeitura.some((f) => f.id === "conecta.proposta.criar"));
  assert.equal(ferramentasVisiveis("gateway_mcp", []).length, 0);
});

test("registro: planejadas aparecem no catálogo mas nunca na lista do LLM", () => {
  assert.equal(d("engenharia.oem.pesquisar").estado, "planejada");
  assert.ok(!ferramentasVisiveis("chat").some((f) => f.id === "engenharia.oem.pesquisar"));
  assert.ok(FERRAMENTAS_CONECTOR.some((f) => f.grupo === "desenvolvimento"));
});

test("nomes para LLM: ida e volta sem perda", () => {
  for (const f of FERRAMENTAS_CONECTOR) {
    assert.match(nomeParaLlm(f.id), /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(idDoNomeLlm(nomeParaLlm(f.id)), f.id);
  }
});

test("allowlist do Bling: nenhum campo proibido (fiscal, custo, fornecedor, preço, estoque, SKU) é permitido", () => {
  for (const p of CAMPOS_BLING_PROIBIDOS) assert.ok(!(CAMPOS_BLING_PERMITIDOS as readonly string[]).includes(p), p);
});

test("policy: ferramenta desconhecida é negada", () => {
  assert.equal(decidir(undefined, { origem: "chat" }).decisao, "negada");
});

test("policy: LLM e cliente externo nunca executam escrita, nem com aprovação", () => {
  for (const origem of ["chat", "gateway_mcp"] as const) {
    const r = decidir(d("bling.produtos.alterar"), { origem, escopos: ["leitura", "propor", "simular"], aprovacaoValida: true, simulado: true });
    assert.equal(r.decisao, "negada", origem); assert.match(r.motivo, /somente_executor/);
  }
});

test("policy: executor sem aprovação válida => requer_aprovacao; com aprovação em modo simulado => simulada", () => {
  assert.equal(decidir(d("bling.produtos.alterar"), { origem: "executor" }).decisao, "requer_aprovacao");
  assert.equal(decidir(d("bling.produtos.alterar"), { origem: "executor", aprovacaoValida: true, simulado: true }).decisao, "simulada");
});

test("policy: produto travado nega escrita antes de qualquer outra coisa", () => {
  const r = decidir(d("bling.produtos.alterar"), { origem: "executor", aprovacaoValida: true, simulado: true, produtoTravado: true });
  assert.equal(r.decisao, "negada"); assert.match(r.motivo, /produto_travado/);
});

test("policy: execução interna (Conecta.IA) aprovada passa; sem aprovação pede aprovação", () => {
  assert.equal(decidir(d("conecta.enriquecimento.definir"), { origem: "executor" }).decisao, "requer_aprovacao");
  assert.equal(decidir(d("conecta.enriquecimento.definir"), { origem: "executor", aprovacaoValida: true }).decisao, "permitida");
  assert.equal(decidir(d("conecta.enriquecimento.definir"), { origem: "chat", aprovacaoValida: true }).decisao, "negada");
});

test("policy: escrita REAL fica negada enquanto a ferramenta está desligada, mesmo aprovada e liberada", () => {
  const r = decidir(d("bling.produtos.alterar"), { origem: "executor", aprovacaoValida: true, simulado: false, escritaRealLiberada: true });
  assert.equal(r.decisao, "negada"); assert.match(r.motivo, /desligada/);
});

test("policy: MCP exige escopo; leitura passa, proposta exige 'propor'", () => {
  assert.equal(decidir(d("conecta.catalogo.resumo"), { origem: "gateway_mcp", escopos: ["leitura"] }).decisao, "permitida");
  assert.equal(decidir(d("conecta.catalogo.resumo"), { origem: "gateway_mcp", escopos: [] }).decisao, "negada");
  assert.equal(decidir(d("conecta.proposta.criar"), { origem: "gateway_mcp", escopos: ["leitura"] }).decisao, "negada");
  assert.equal(decidir(d("conecta.proposta.criar"), { origem: "gateway_mcp", escopos: ["propor"] }).decisao, "permitida");
});

test("policy: ferramenta não exposta ao MCP (busca de imagem/plugins) é negada no gateway", () => {
  assert.equal(decidir(d("conecta.plugins.chamar"), { origem: "gateway_mcp", escopos: ["leitura"] }).decisao, "negada");
  assert.equal(decidir(d("conecta.plugins.chamar"), { origem: "chat" }).decisao, "permitida");
});

test("policy: planejada é negada; executor não chama ferramenta comum", () => {
  assert.match(decidir(d("engenharia.oem.pesquisar"), { origem: "chat" }).motivo, /planejada/);
  assert.equal(decidir(d("conecta.catalogo.resumo"), { origem: "executor" }).decisao, "negada");
});

test("schema: valida tipos, obrigatórios e recusa campo desconhecido", () => {
  const s = d("conecta.catalogo.ver").entrada;
  assert.equal(validar(s, { sku: "80692" }).length, 0);
  assert.ok(validar(s, {}).length > 0);
  assert.ok(validar(s, { sku: "x", extra: 1 }).some((e) => /não permitido/.test(e.erro)));
  assert.ok(validar(s, { sku: 5 }).length > 0);
  const p = d("conecta.proposta.criar").entrada;
  assert.ok(validar(p, { titulo: "t", itens: [{ operacao: "bling.produtos.alterar", depois: {}, fontes: [] }] }).length > 0, "fontes vazias recusadas");
  assert.equal(validar(p, { titulo: "Enriquecer cabeçote", itens: [{ operacao: "conecta.enriquecimento.definir", depois: { marca: "Sabó" }, fontes: [{ url: "https://x.com/a" }] }] }).length, 0);
});

test("cripto: token tem 256 bits, formato reconhecível e hash estável", async () => {
  const { token, prefixo } = gerarToken();
  assert.ok(pareceTokenMcp(token)); assert.ok(token.startsWith(prefixo));
  assert.notEqual(gerarToken().token, token);
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("busca direta por OEM: ferramenta de leitura ativa, com código obrigatório e exposta ao gateway", () => {
  const f = buscarDefinicao("engenharia.oem.buscar")!;
  assert.ok(f, "registrada");
  assert.equal(f.permissao, "leitura");
  assert.equal(f.estado, "ativa");
  assert.ok(f.exposicao.mcp);
  assert.ok(validar(f.entrada, {}).length > 0, "sem código é recusado");
  assert.equal(validar(f.entrada, { codigo: "20910-4AU07" }).length, 0);
});

test("ferramentas de verificação: ativas, somente leitura e com entrada validada", () => {
  for (const id of ["engenharia.duplicidade.detectar", "engenharia.cruzados.verificar", "engenharia.aplicacoes.validar"]) {
    const f = buscarDefinicao(id)!;
    assert.equal(f.estado, "ativa", id);
    assert.equal(f.permissao, "leitura", id);
  }
  assert.ok(validar(buscarDefinicao("engenharia.cruzados.verificar")!.entrada, {}).length > 0, "sku obrigatório");
  assert.equal(validar(buscarDefinicao("engenharia.aplicacoes.validar")!.entrada, { sku: "80692", ano: 2018 }).length, 0);
  assert.ok(validar(buscarDefinicao("engenharia.aplicacoes.validar")!.entrada, { sku: "80692", ano: "2018" }).length > 0, "ano precisa ser número");
  assert.equal(validar(buscarDefinicao("engenharia.duplicidade.detectar")!.entrada, {}).length, 0, "sem filtro = varredura da loja");
});

test("regra do sistema: nenhuma ferramenta apaga nota fiscal nem o cadastro espelhado do Bling", () => {
  for (const f of FERRAMENTAS_CONECTOR) assert.doesNotMatch(f.id, /excluir|apagar|delete|remov|destroy|\.nfe\.|nota_fiscal/i, f.id);
});

test("ferramentas de web: ativas, só leitura, no chat e fora do MCP, com URL obrigatória", async () => {
  const { buscarDefinicao } = await import("./registro.ts");
  for (const id of ["web.buscar", "web.pagina.ler"]) {
    const d = buscarDefinicao(id)!;
    assert.equal(d.estado, "ativa"); assert.equal(d.permissao, "leitura"); assert.equal(d.risco, "LOW");
    assert.equal(d.escreveExterno, false); assert.equal(d.exposicao.chat, true); assert.equal(d.exposicao.mcp, false);
  }
  assert.deepEqual(buscarDefinicao("web.pagina.ler")!.entrada.required, ["url"]);
});
