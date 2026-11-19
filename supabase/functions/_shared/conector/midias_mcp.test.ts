import { test } from "node:test";
import assert from "node:assert/strict";
import { anexarMidiaMcp, validarArquivoMcp } from "./midias_mcp.ts";
import { entradaParaAuditoria } from "./despacho.ts";
import { buscarDefinicao, ferramentasVisiveis } from "./registro.ts";

const LOJA = "11111111-1111-4111-8111-111111111111";
const PRODUTO = "22222222-2222-4222-8222-222222222222";
const APLICACAO = "33333333-3333-4333-8333-333333333333";
const ARQUIVO = { download_url: "https://uploads.openaiusercontent.com/anexo-temporario?sig=segredo", file_id: "file_1234567890", mime_type: "image/png", file_name: "motor-hr.png" };
const BYTES = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82,0,0,3,32,0,0,2,88]);

function ambiente(opts: { produto?: boolean; aplicacao?: boolean; falhaBanco?: boolean } = {}) {
  const anexos: { path: string; body: Uint8Array }[] = [], linhas: Record<string, unknown>[] = [], removidos: string[] = [];
  const chain = (dados: unknown, tabela: string): any => ({
    select: (_s: string) => chain(dados, tabela),
    eq: (_key: string, _value: unknown) => chain(dados, tabela),
    maybeSingle: async () => ({ data: dados, error: null }),
    insert: (v: Record<string, unknown>) => { linhas.push(v); return chain({ id: "44444444-4444-4444-8444-444444444444" }, tabela); },
    single: async () => opts.falhaBanco && tabela === "conecta_midia_pendentes"
      ? { data: null, error: { message: "indisponivel" } } : { data: dados, error: null },
  });
  const admin = {
    from(tabela: string) {
      if (tabela === "produtos") return chain(opts.produto === false ? null : { id: PRODUTO }, tabela);
      if (tabela === "produto_aplicacoes") return chain(opts.aplicacao === false ? null : { id: APLICACAO, pagina_slug: "ci003696-hr" }, tabela);
      return chain(null, tabela);
    },
    storage: { from(_bucket: string) { return {
      upload: async (path: string, body: Uint8Array) => { anexos.push({ path, body }); return { error: null }; },
      remove: async (paths: string[]) => { removidos.push(...paths); return { error: null }; },
    }; } },
  };
  const contexto = { lojaId: LOJA, userId: LOJA, admin: admin as any };
  const verificar = async (_url: string, op: { capturarBytes?: (bytes: Uint8Array) => void }) => {
    op.capturarBytes?.(BYTES);
    return { ok: true as const, imagem: { sha256: "a".repeat(64), bytes: BYTES.length, mime: "image/png" as const,
      largura_px: 800, altura_px: 600, url_final: "https://uploads.openaiusercontent.com/img", avisos: [] } };
  };
  return { contexto, verificar, anexos, linhas, removidos };
}

test("MCP: arquivo válido anuncia as quatro propriedades e meta fileParams no registro", () => {
  for (const nome of ["conecta.midia.anexar_produto", "conecta.banner.anexar"]) {
    const d = buscarDefinicao(nome)!;
    assert.equal(d.estado, "ativa");
    assert.equal(d.permissao, "propor");
    assert.deepEqual(d.fileParams, ["file"]);
    const f = d.entrada.properties!.file;
    assert.deepEqual(f.required, ["download_url", "file_id"]);
    assert.deepEqual(Object.keys(f.properties!).sort(), ["download_url", "file_id", "file_name", "mime_type"].sort());
    assert.equal(f.additionalProperties, false);
    assert.equal(ferramentasVisiveis("gateway_mcp", ["leitura"]).some(f => f.id === nome), false);
    assert.equal(ferramentasVisiveis("gateway_mcp", ["propor"]).some(f => f.id === nome), true);
  }
});

test("MCP: URL privada, file_id e assinatura nunca entram na auditoria", () => {
  const e = { sku: "CI003696", file: ARQUIVO };
  const texto = JSON.stringify(entradaParaAuditoria("conecta.midia.anexar_produto", e));
  assert.doesNotMatch(texto, /segredo|download_url|file_1234567890|openaiusercontent/);
  assert.equal(validarArquivoMcp({ ...ARQUIVO, download_url: "http://localhost:5000/segredo" }).ok, false);
  assert.equal(validarArquivoMcp({ ...ARQUIVO, mime_type: "application/pdf" }).ok, false);
});

test("MCP: foto do SKU físico fica privada e pendente; nunca envia ao Bling", async () => {
  const { contexto, verificar, anexos, linhas } = ambiente();
  const r: any = await anexarMidiaMcp(contexto, { sku: "CI003696", file: ARQUIVO }, "foto_produto", {}, verificar as any);
  assert.equal(r.ok, true); assert.equal(r.status, "a_confirmar");
  assert.equal(r.pagina_aplicacao, null);
  assert.equal(anexos.length, 1); assert.match(anexos[0].path, new RegExp("^mcp-midias/" + LOJA + "/"));
  assert.equal(linhas.length, 1); assert.equal(linhas[0].storage_bucket, "agente-anexos");
  assert.equal(linhas[0].finalidade, "foto_produto");
  assert.equal(linhas[0].status, "a_confirmar");
  const gravado = JSON.stringify(linhas);
  assert.doesNotMatch(gravado, /segredo|openaiusercontent|file_1234567890/);
});

test("MCP: banner por veículo exige aplicação aprovada da mesma loja e produto", async () => {
  const t = ambiente({ aplicacao: false });
  const pedido = { sku: "CI003696", file: ARQUIVO, modo: "por_veiculo", titulo: "Motor HR Euro V", aplicacao_id: APLICACAO };
  const negado: any = await anexarMidiaMcp(t.contexto, pedido, "banner", {}, t.verificar as any);
  assert.ok(negado.erro); assert.equal(t.anexos.length, 0);
  const ok = ambiente({ aplicacao: true });
  const resposta: any = await anexarMidiaMcp(ok.contexto, pedido, "banner", {}, ok.verificar as any);
  assert.equal(resposta.status, "a_confirmar");
  assert.equal(resposta.pagina_aplicacao, "#/a/ci003696-hr");
  assert.equal(ok.linhas[0].aplicacao_id, APLICACAO);
});

test("MCP: SKU inexistente não produz arquivo; erro de banco limpa armazenamento", async () => {
  const inexistente = ambiente({ produto: false });
  const r: any = await anexarMidiaMcp(inexistente.contexto, { sku: "ERRADO", file: ARQUIVO }, "foto_produto", {}, inexistente.verificar as any);
  assert.ok(r.erro); assert.equal(inexistente.anexos.length, 0);
  const falha = ambiente({ falhaBanco: true });
  const rr: any = await anexarMidiaMcp(falha.contexto, { sku: "CI003696", file: ARQUIVO }, "foto_produto", {}, falha.verificar as any);
  assert.ok(rr.erro); assert.equal(falha.anexos.length, 1); assert.equal(falha.removidos.length, 1);
});
