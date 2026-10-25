import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarProduto, gtinValido, MAX_CANDIDATOS, validarTermo, type LinhaEspelho, type PortasBusca } from "./busca_produto.ts";

// Os 8 registros EXCLUÍDOS do teste real (dados lidos do Bling em 2026-10-25; sintéticos aqui só no formato da listagem).
const GTIN = "3276428333335";
const R = (id: number, codigo: string, nome: string, estoque = 0, preco = 1950) => ({ id, codigo, nome, situacao: "E", preco, estoque: { saldoVirtualTotal: estoque } });
const K5112 = R(12753970402, "5112", "833333 KIT EMBREAGEM 254MM(PLATODISCOROLAM)", 1, 1500);
const K833_A = R(8173252121, "833333", "Kit Embreagem 254mm(platodiscorolam) Hyundai Hr/K2500 Euro 5 Original 833333");
const K833_B = R(16622651374, "833333", "Kit Embreagem 254mm(platodiscorolam) Hyundai Hr/K2500 Euro 5 Original 833333");
const K4891 = R(7538741982, "4891", "KIT EMBREAGEM 254MM(PLATODISCOROLAM) HYUNDAI HR KIA BONGO EURO 5 ORIGINAL 833333", 0, 2200);
const K833_1a = R(16514593039, "833333/1", "Kit Embreagem 254mm(platodiscorolam) Hyundai Hr/K2500 Euro 5");
const K833_1b = R(16622651373, "833333/1", "Kit Embreagem 254mm(platodiscorolam) Hyundai Hr/K2500 Euro 5");
const EAT_a = R(16559870756, "89096", "104108-2 KIT EMBREAGEM - EAT");
const EAT_b = R(16622651026, "89096", "104108-2 KIT EMBREAGEM - EAT");
const OITO = [K5112, K833_A, K833_B, K4891, K833_1a, K833_1b, EAT_a, EAT_b];

/** API falsa: responde pelo filtro do caminho, como o Bling (`criterio=5` inclui excluídos; `=2` só ativos). */
function api(base: Record<string, unknown>[] = OITO, opc: { falha?: number; erro?: boolean; paginas?: Record<string, Record<string, unknown>[][]> } = {}) {
  const chamadas: string[] = [];
  const portas: Pick<PortasBusca, "listarApi" | "espera"> = {
    async espera() {},
    async listarApi(caminho) {
      chamadas.push(caminho);
      if (opc.erro) throw new Error("timeout");
      if (opc.falha) return { ok: false, status: opc.falha, itens: [] };
      const q = new URL("https://x" + caminho).searchParams; const crit = q.get("criterio"); const pag = Number(q.get("pagina") ?? 1);
      const cod = q.get("codigos[]"); const nome = q.get("nome"); const gtin = q.get("gtins[]");
      if (opc.paginas) { const chave = cod ? "cod" : nome ? "nome" : "gtin"; return { ok: true, status: 200, itens: opc.paginas[chave]?.[pag - 1] ?? [] }; }
      let lista = base.filter((r) => crit === "5" || r.situacao === "A");
      if (cod) lista = lista.filter((r) => r.codigo === cod);
      else if (nome) lista = lista.filter((r) => `${r.nome} ${r.codigo}`.toLowerCase().includes(nome.toLowerCase()));
      else if (gtin) lista = gtin === GTIN ? lista : [];
      return { ok: true, status: 200, itens: lista };
    },
  };
  return { portas, chamadas };
}
const ports = (a: ReturnType<typeof api>, espelho: LinhaEspelho[] = []): PortasBusca => ({ ...a.portas, espelho: async () => espelho });

test("SKU 833333 duplicado: devolve os DOIS registros, sem mesclar, e também as referências no nome", async () => {
  const r = await buscarProduto({ termo: "833333" }, ports(api()));
  const ids = r.candidatos.map((c) => c.id);
  assert.ok(ids.includes("8173252121") && ids.includes("16622651374"), "os dois SKU 833333");
  assert.equal(r.candidatos.filter((c) => c.sku === "833333").length, 2);
  assert.ok(ids.includes("12753970402") && ids.includes("7538741982"), "5112 e 4891 trazem 833333 no nome");
  assert.ok(ids.includes("16514593039") && ids.includes("16622651373"), "833333/1 contém a referência no código");
  assert.ok(!ids.includes("16559870756"), "EAT (89096) não casa por SKU nem por nome");
  assert.ok(r.candidatos.every((c) => c.situacao === "excluido" && c.origem === "api_bling"));
  assert.deepEqual(r.candidatos.filter((c) => c.sku === "833333").map((c) => c.achado_por.includes("sku_exato")), [true, true]);
});

test("GTIN colidido com EAT: os 8 candidatos vêm, cada um só com 'gtin' como motivo, e o aviso diz que GTIN não prova identidade", async () => {
  assert.ok(gtinValido(GTIN));
  const r = await buscarProduto({ termo: GTIN }, ports(api()));
  assert.equal(r.total_candidatos, 8); assert.equal(r.truncado, false);
  assert.ok(r.candidatos.every((c) => c.achado_por.length === 1 && c.achado_por[0] === "gtin"));
  const eat = r.candidatos.filter((c) => c.nome?.includes("EAT")); assert.equal(eat.length, 2);
  assert.match(r.conclusao.aviso, /GTIN repetido indica conflito de cadastro e não prova, sozinho, que sejam a mesma peça nem peças diferentes/);
  assert.equal(r.conclusao.autoriza_criacao, false);
});

test("SKU interno 5112: um candidato, excluído, com o saldo da API", async () => {
  const r = await buscarProduto({ termo: "5112" }, ports(api()));
  const c = r.candidatos.find((x) => x.sku === "5112")!;
  assert.equal(c.id, "12753970402"); assert.equal(c.situacao, "excluido"); assert.equal(c.estoque, 1); assert.ok(c.achado_por.includes("sku_exato"));
  assert.equal(c.no_espelho, false, "excluído não está no espelho: isso não é ausência no ERP");
});

test("nenhum candidato ativo: todos aparecem como excluídos e a ausência NÃO é declarada", async () => {
  const r = await buscarProduto({ termo: "833333" }, ports(api()));
  assert.equal(r.candidatos.filter((c) => c.situacao === "ativo").length, 0);
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, false);
  assert.match(r.conclusao.aviso, /excluído\/inativo não é equivalência/);
});

test("API indisponível (403): sem candidato no espelho, a resposta NÃO afirma ausência no ERP (o bug do teste real)", async () => {
  const a = api([], { falha: 403 });
  const r = await buscarProduto({ termo: "833333" }, ports(a));
  assert.equal(r.total_candidatos, 0);
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, false); assert.equal(r.conclusao.api_completa, false); assert.equal(r.conclusao.apenas_espelho, true);
  assert.equal(r.conclusao.autoriza_criacao, false);
  assert.match(r.conclusao.aviso, /NÃO foi consultada por completo/);
  const f = r.fontes.find((x) => x.origem === "api_bling")!; assert.equal(f.consultada, false); assert.equal(f.motivo, "reconectar_bling");
  assert.equal(a.chamadas.length, 1, "não insiste nas demais consultas com a API fora do ar");
});

test("timeout da API vira 'tempo_esgotado' e o produto do espelho aparece com origem 'espelho' (sem rótulo de API)", async () => {
  const esp: LinhaEspelho[] = [{ bling_id: "99", sku: "833333", nome: "Peça ativa", preco: "10", estoque: "2", situacao: "A", sincronizado_em: "2026-10-25T11:06:00Z" }];
  const r = await buscarProduto({ termo: "833333" }, ports(api([], { erro: true }), esp));
  assert.equal(r.fontes.find((x) => x.origem === "api_bling")!.motivo, "tempo_esgotado");
  const c = r.candidatos[0]; assert.equal(c.origem, "espelho"); assert.equal(c.situacao, "ativo"); assert.equal(c.sincronizado_em, "2026-10-25T11:06:00Z");
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, false);
});

test("espelho + API: o mesmo produto vira UM candidato, com campos da API e marcado no_espelho", async () => {
  const ativo = { id: 99, codigo: "833333", nome: "Peça ativa", situacao: "A", preco: 11, estoque: { saldoVirtualTotal: 3 } };
  const esp: LinhaEspelho[] = [{ bling_id: "99", sku: "833333", nome: "Peça ativa", preco: "10", estoque: "2", situacao: "A", sincronizado_em: "2026-10-25T11:06:00Z" }];
  const r = await buscarProduto({ termo: "833333" }, ports(api([ativo]), esp));
  assert.equal(r.candidatos.length, 1);
  const c = r.candidatos[0]; assert.equal(c.origem, "api_bling"); assert.equal(c.preco, 11); assert.equal(c.estoque, 3); assert.equal(c.no_espelho, true);
  assert.equal(c.sincronizado_em, "2026-10-25T11:06:00Z");
});

test("paginação: mais de uma página é lida; passou do limite de páginas, declara e não comprova ausência", async () => {
  const cheia = (n: number, ini: number) => Array.from({ length: n }, (_, i) => R(ini + i, `S${ini + i}`, `Peça 833333 modelo ${ini + i}`));
  const r = await buscarProduto({ termo: "833333" }, ports(api([], { paginas: { cod: [[]], nome: [cheia(100, 1000), cheia(100, 2000), cheia(100, 3000)] } })));
  const f = r.fontes.find((x) => x.consulta === "referencia_no_nome")!;
  assert.equal(f.paginas, 3); assert.equal(f.completa, false); assert.equal(f.motivo, "paginas_limite_atingido");
  assert.equal(r.total_candidatos, 300); assert.equal(r.truncado, true); assert.equal(r.candidatos.length, MAX_CANDIDATOS);
  assert.equal(r.conclusao.api_completa, false); assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, false);
  const dois = await buscarProduto({ termo: "833333" }, ports(api([], { paginas: { cod: [[]], nome: [cheia(100, 1), cheia(20, 500)] } })));
  assert.equal(dois.total_candidatos, 120); assert.equal(dois.fontes.find((x) => x.consulta === "referencia_no_nome")!.completa, true);
});

test("ausência só é comprovada com a API completa e critério 'todos'; mesmo assim NÃO autoriza criar", async () => {
  const a = api([]);
  const r = await buscarProduto({ termo: "ZZ-INEXISTENTE-1" }, ports(a));
  assert.equal(r.conclusao.ausencia_nos_filtros_pesquisados, true); assert.equal(r.conclusao.autoriza_criacao, false);
  assert.match(r.conclusao.aviso, /NÃO autoriza criar cadastro/);
  assert.ok(a.chamadas.every((c) => c.includes("criterio=5")), "inclui excluídos");
  const so = await buscarProduto({ termo: "ZZ-INEXISTENTE-1", incluirExcluidos: false }, ports(api([])));
  assert.equal(so.conclusao.ausencia_nos_filtros_pesquisados, false); assert.match(so.conclusao.aviso, /ATIVOS/);
});

test("termo inválido ou com caracteres de injeção é recusado sem tocar em API nem espelho", async () => {
  const a = api();
  for (const t of ["", "   ", "x".repeat(81), "833333&criterio=1", "833333;drop", "a,b", "\u0000", "83\u00003333"]) await assert.rejects(buscarProduto({ termo: t }, ports(a)), /inválido|Informe/);
  assert.equal(a.chamadas.length, 0);
  assert.equal(validarTermo(" 833333/1 "), "833333/1"); assert.equal(validarTermo("833333\n"), "833333"); assert.equal(validarTermo("Kit  Valeo"), "Kit Valeo");
});
