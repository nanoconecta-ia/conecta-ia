import { test } from "node:test";
import assert from "node:assert/strict";
import { consultarProduto, LIMITE_MODELO } from "./bling_consultar.ts";
import { cifrar } from "../cripto.ts";

const chave = btoa("q".repeat(32));
const token = "TOKEN-SINTETICO-" + "x".repeat(3000);
const cifrado = await cifrar(token, chave);
type Item = Record<string, unknown>;
const ESPELHO = [
  { loja_id: "A", bling_id: "1234", sku: "SKU-1", nome: "Espelho da loja A", preco: 12, estoque: 2, situacao: "A", sincronizado_em: "2026-10-18T00:00:00Z" },
  { loja_id: "B", bling_id: "7777", sku: "SKU-1", nome: "Produto da OUTRA loja", preco: 99, estoque: 9, situacao: "A", sincronizado_em: "2026-10-18T00:00:00Z" },
];

function ambiente({ flag = true, auditoria = true, limite = true, status = 200, itens = null as Item[] | null, espelho = ESPELHO }: { flag?: boolean; auditoria?: boolean; limite?: boolean; status?: number; itens?: Item[] | null; espelho?: typeof ESPELHO } = {}) {
  const calls: { url: string; op: RequestInit }[] = []; const audits: Record<string, unknown>[] = []; const consultas: { t: string; filtros: Record<string, unknown> }[] = []; const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const api: Item[] = itens ?? [{ id: 1234, codigo: "SKU-1", nome: "Produto API", situacao: "A", preco: 34.5, estoque: { saldoVirtualTotal: -2.5 }, fornecedor: { precoCusto: 999 }, token: "segredo" }];
  const usuario = {
    from(t: string) {
      const filtros: Record<string, unknown> = {};
      const q: any = {
        select() { return q; }, eq(k: string, v: unknown) { filtros[k] = v; return q; }, ilike(k: string, v: unknown) { filtros[k] = v; return q; }, limit() { return q; },
        then(ok: (v: unknown) => unknown, no: (e: unknown) => unknown) {
          consultas.push({ t, filtros: { ...filtros } });
          if (t === "recursos_efetivos") return Promise.resolve({ data: [{ ativo: flag }] }).then(ok, no);
          const sku = filtros.sku as string | undefined; const nome = filtros.nome as string | undefined;
          const linhas = espelho.filter((r) => r.loja_id === filtros.loja_id && (sku ? r.sku === sku : true) && (nome ? r.nome.toLowerCase().includes(nome.replace(/^%|%$/g, "").toLowerCase()) : true));
          return Promise.resolve({ data: linhas.map(({ loja_id: _l, ...r }) => r), error: null }).then(ok, no);
        },
      };
      return q;
    },
  };
  const admin = {
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcs.push({ fn, args });
      if (fn === "limite_chamada") return { data: limite };
      if (fn === "bling_ler_credenciais") return { data: [{ access_token_cifrado: cifrado, refresh_token_cifrado: cifrado, expira_em: new Date(Date.now() + 86400000).toISOString() }] };
      throw Error("RPC inesperada " + fn);
    },
    from(t: string) { assert.equal(t, "auditoria"); return { async insert(v: Record<string, unknown>) { audits.push(v); return { error: auditoria ? null : {} }; } }; },
  };
  const fake: typeof fetch = async (url, op) => {
    calls.push({ url: String(url), op: op! });
    assert.equal(op?.method, "GET"); assert.equal(op?.redirect, "manual"); assert.equal((op?.headers as Record<string, string>).Authorization, "Bearer " + token);
    const q = new URL(String(url)).searchParams; const cod = q.get("codigos[]"); const nome = q.get("nome");
    let lista = api.filter((r) => q.get("criterio") === "5" || r.situacao === "A");
    if (cod) lista = lista.filter((r) => r.codigo === cod); else if (nome) lista = lista.filter((r) => String(r.nome).toLowerCase().startsWith(nome.toLowerCase())); // resposta real observada: nome não é substring em nome+SKU
    return Response.json({ data: lista }, { status });
  };
  const ctx: any = { usuario, admin, lojaId: "A", userId: "U", conversaId: "C", cfg: { chaveCifra: chave, fetch: fake, espera: async () => {} }, simulado: true, chamadas: [], evidencias: [] };
  return { ctx, calls, audits, consultas, rpcs };
}

test("API: JWT completo, GET fixo, origem real, candidatos, allowlist e auditoria", async () => {
  const a = ambiente(); const r: any = await consultarProduto({ sku: "SKU-1" }, a.ctx);
  assert.equal(r.origem, "api_bling"); assert.equal(r.simulado, true);
  assert.equal(r.candidatos.length, 1); const c = r.candidatos[0];
  assert.equal(c.origem, "api_bling"); assert.equal(c.preco, 34.5); assert.equal(c.estoque, -2.5); assert.equal(c.no_espelho, true); assert.deepEqual(c.achado_por.sort(), ["sku_exato"]); // o filtro nome real não casa SKU
  assert.equal(r.dados.preco, 34.5); assert.equal(r.conclusao.autoriza_criacao, false);
  assert.ok(a.calls.every((x) => x.url.startsWith("https://api.bling.com.br/Api/v3/produtos?") && x.url.includes("criterio=5")), "API consultada incluindo excluídos");
  assert.equal(a.audits.length, 1); assert.equal(a.ctx.chamadas[0].hash.length, 64);
  assert.ok(!JSON.stringify(r).includes("segredo") && !JSON.stringify(r).includes("999")); assert.ok(!JSON.stringify(a.audits).includes("TOKEN"));
});

test("PRODUTO EXCLUÍDO que não está no espelho é encontrado pela API e declarado como excluído (o falso negativo do teste real)", async () => {
  const a = ambiente({ espelho: [], itens: [{ id: 12753970402, codigo: "5112", nome: "833333 KIT EMBREAGEM 254MM", situacao: "E", preco: 1500, estoque: { saldoVirtualTotal: 1 } }] });
  const r: any = await consultarProduto({ codigo: "5112" }, a.ctx);
  assert.equal(r.candidatos.length, 1); const c = r.candidatos[0];
  assert.equal(c.situacao, "excluido"); assert.equal(c.no_espelho, false); assert.equal(c.origem, "api_bling"); assert.equal(c.estoque, 1);
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, false); assert.match(r.conclusao.aviso, /excluído\/inativo não é equivalência/);
});

test("nada encontrado com a API completa: ausência comprovada, mas NUNCA autoriza criar", async () => {
  const a = ambiente({ espelho: [], itens: [] });
  const r: any = await consultarProduto({ codigo: "ZZ-NAO-EXISTE" }, a.ctx);
  assert.equal(r.candidatos.length, 0); assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, true); assert.equal(r.conclusao.autoriza_criacao, false);
  assert.equal(a.audits.length, 1); assert.equal(a.audits[0].depois && (a.audits[0].depois as any).ausencia_nos_filtros_pesquisados, true);
});

for (const status of [403, 429]) test(`API fora (${status}) e nada no espelho: NÃO lança "não encontrado" e NÃO afirma ausência no ERP`, async () => {
  const a = ambiente({ espelho: [], status });
  const r: any = await consultarProduto({ codigo: "833333" }, a.ctx);
  assert.equal(r.candidatos.length, 0); assert.equal(r.origem, "espelho");
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, false); assert.equal(r.conclusao.apenas_espelho, true); assert.equal(r.conclusao.autoriza_criacao, false);
  assert.match(r.conclusao.aviso, /NÃO foi consultada por completo/); assert.ok(r.motivo);
});

test("API fora, mas o espelho tem o produto: origem 'espelho' com data, sem rótulo de API", async () => {
  const a = ambiente({ status: 403 });
  const r: any = await consultarProduto({ sku: "SKU-1" }, a.ctx);
  assert.equal(r.origem, "espelho"); assert.equal(r.candidatos[0].origem, "espelho"); assert.equal(r.candidatos[0].preco, 12); assert.ok(r.sincronizado_em);
});

test("API parcial não usa estoque do espelho com rótulo de API", async () => {
  const a = ambiente({ itens: [{ id: 1234, codigo: "SKU-1", nome: "Produto API", situacao: "A", preco: 34.5 }] });
  const r: any = await consultarProduto({ sku: "SKU-1" }, a.ctx);
  assert.equal(r.candidatos[0].origem, "api_bling"); assert.equal(r.candidatos[0].estoque, null);
});

test("ISOLAMENTO POR LOJA: o produto da outra loja nunca aparece, filtros e credenciais são da loja do contexto", async () => {
  const a = ambiente({ status: 403 }); // só o espelho responde
  const r: any = await consultarProduto({ codigo: "SKU-1" }, a.ctx);
  assert.deepEqual(r.candidatos.map((c: any) => c.id), ["1234"]); assert.ok(!JSON.stringify(r).includes("OUTRA loja") && !JSON.stringify(r).includes("7777"));
  const doEspelho = a.consultas.filter((q) => q.t === "produtos"); assert.ok(doEspelho.length >= 1); assert.ok(a.rpcs.some((x) => x.fn === "bling_ler_credenciais"), "a API foi tentada com credenciais");
  assert.ok(doEspelho.every((q) => q.filtros.loja_id === "A"), "toda consulta ao espelho filtra por loja_id");
  assert.ok(a.rpcs.filter((x) => x.fn === "bling_ler_credenciais").every((x) => x.args.p_loja_id === "A"), "credenciais lidas só da loja A");
  const outra = ambiente({ espelho: ESPELHO.filter((x) => x.loja_id === "B"), status: 403 });
  const r2: any = await consultarProduto({ codigo: "SKU-1" }, outra.ctx);
  assert.equal(r2.candidatos.length, 0, "a loja A não enxerga linhas da loja B");
});

for (const op of [{ flag: false }, { limite: false }]) test("negativa sem API " + JSON.stringify(op), async () => {
  const a = ambiente(op); await assert.rejects(consultarProduto({ sku: "SKU-1" }, a.ctx)); assert.equal(a.calls.length, 0);
});
test("não aceita URL, ID livre, campos extras nem código inválido", async () => {
  const a = ambiente();
  for (const e of [{ sku: "SKU-1", url: "https://malicioso.test" }, { codigo: "A", sku: "B" }, { codigo: "x&criterio=1" }, { codigo: "" }, { incluir_excluidos: "sim", codigo: "A" }, null, [], "SKU-1"]) await assert.rejects(consultarProduto(e, a.ctx));
  assert.equal(a.calls.length, 0); assert.equal(a.audits.length, 0);
});
test("falha de auditoria impede entregar dado ao modelo", async () => {
  const a = ambiente({ auditoria: false }); await assert.rejects(consultarProduto({ sku: "SKU-1" }, a.ctx), /auditar/); assert.equal(a.ctx.evidencias.length, 0);
});
test("limite por turno impede quarta consulta", async () => {
  const a = ambiente(); for (let n = 0; n < 3; n++) await consultarProduto({ sku: "SKU-1" }, a.ctx);
  const antes = a.calls.length; await assert.rejects(consultarProduto({ sku: "SKU-1" }, a.ctx), /três/); assert.equal(a.calls.length, antes);
});

test("resultado grande: o modelo recebe JSON VÁLIDO com fontes, conclusao, total e lista parcial; a UI guarda a lista completa", async () => {
  const itens = Array.from({ length: 50 }, (_, i) => ({ id: 9000 + i, codigo: `COD-${i}`, nome: `833333 KIT EMBREAGEM ${"x".repeat(180)} ${i}`, situacao: i % 2 ? "E" : "A", preco: 10 + i, estoque: { saldoVirtualTotal: i } }));
  const a = ambiente({ espelho: [], itens });
  const r: any = await consultarProduto({ codigo: "833333" }, a.ctx);
  const completo = a.ctx.evidencias[0] as any;
  assert.ok(JSON.stringify(completo).length > 6000, "a evidência completa passa de 6.000 caracteres");
  assert.equal(completo.candidatos.length, 50, "a UI mantém a lista completa");
  const modelo = JSON.stringify(r); assert.ok(modelo.length <= LIMITE_MODELO);
  const volta = JSON.parse(modelo);
  assert.equal(volta.lista_parcial, true); assert.equal(volta.total_candidatos, 50); assert.ok(volta.candidatos_omitidos > 0); assert.equal(volta.candidatos.length + volta.candidatos_omitidos, 50);
  assert.equal(volta.conclusao.autoriza_criacao, false); assert.ok(volta.conclusao.escopo.campos_nao_cobertos.length > 0); assert.ok(volta.fontes.length >= 2); assert.match(volta.aviso_lista, /PARCIAL/);
  // o laço de conversa também não pode cortar o JSON no meio
  const { reduzirJson } = await import("../ia/reducao.ts");
  const gigante = { ...volta, candidatos: Array.from({ length: 200 }, (_, i) => ({ id: i, nome: "y".repeat(100) })) };
  const red = JSON.parse(reduzirJson(gigante, 6000));
  assert.ok(JSON.stringify(red).length <= 6000); assert.equal(red._reducao.truncado, true); assert.ok(red._reducao.omitidos.candidatos > 0);
  assert.equal(red.conclusao.autoriza_criacao, false); assert.equal(red.total_candidatos, 50); assert.ok(red.fontes);
});

test("escopo da ausência: referência só fora de nome/SKU NÃO é coberta; zero resultado não é prova universal", async () => {
  // o produto existe no ERP só com a referência no campo do fabricante/descrição: os filtros (SKU, nome) não o veem
  const a = ambiente({ espelho: [], itens: [{ id: 1, codigo: "OUTRO", nome: "KIT DE EMBREAGEM", situacao: "A", marca: "VALEO", descricao: "REF 833333" }] });
  const r: any = await consultarProduto({ codigo: "833333" }, a.ctx);
  assert.equal(r.candidatos.length, 0);
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, true); assert.equal(r.conclusao.escopo.prova_universal, false); assert.equal(r.conclusao.autoriza_criacao, false);
  assert.deepEqual(r.conclusao.escopo.filtros_concluidos, ["sku_exato", "referencia_no_nome"]);
  for (const campo of ["descrição", "marca/fabricante", "código do fornecedor"]) assert.ok(r.conclusao.escopo.campos_nao_cobertos.includes(campo));
  assert.match(r.conclusao.aviso, /NÃO é prova de que o produto não existe/);
});

test("termo curto (<3): filtro por nome não roda e o escopo declara isso", async () => {
  const a = ambiente({ espelho: [], itens: [] });
  const r: any = await consultarProduto({ codigo: "A7" }, a.ctx);
  assert.deepEqual(r.conclusao.escopo.filtros_concluidos, ["sku_exato"]); assert.deepEqual(r.conclusao.escopo.filtros_planejados, ["sku_exato"]); assert.equal(r.conclusao.escopo.filtro_nome_aplicado, false);
  assert.ok(r.conclusao.escopo.campos_nao_cobertos.some((c: string) => /menos de 3 caracteres/.test(c)));
  assert.ok(a.calls.every((x) => !x.url.includes("nome=")), "nenhuma consulta por nome com termo curto"); assert.equal(r.conclusao.autoriza_criacao, false);
});

test("busca limitada: 300 encontrados, evidência com 50 — o aviso NÃO diz que a tela tem a lista completa", async () => {
  const itens = Array.from({ length: 300 }, (_, i) => ({ id: 5000 + i, codigo: "833333", nome: `KIT ${i}`, situacao: "E", preco: 1, estoque: { saldoVirtualTotal: 0 } }));
  const a = ambiente({ espelho: [], itens });
  const r: any = await consultarProduto({ codigo: "833333" }, a.ctx);
  const ev = a.ctx.evidencias[0] as any;
  assert.equal(ev.total_candidatos, 300); assert.equal(ev.candidatos.length, 50); assert.equal(ev.truncado, true);
  assert.equal(r.total_candidatos, 300); assert.equal(r.lista_parcial, true); assert.ok(JSON.stringify(r).length <= LIMITE_MODELO); assert.equal(JSON.parse(JSON.stringify(r)).candidatos.length, r.candidatos_retornados);
  assert.equal(r.candidatos_omitidos, 300 - r.candidatos_retornados);
  assert.match(r.aviso_lista, /nem a tela mostra/); assert.doesNotMatch(r.aviso_lista, /lista completa/);
});
