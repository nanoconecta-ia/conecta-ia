import { test } from "node:test";
import assert from "node:assert/strict";
import { validarAplicacao, validarIntercambiabilidade, fonteForte, type Contexto, type Fonte, type ProdutoTecnico, type PropostaAplicacao } from "./regras_aplicacao.ts";
import { validarTaxonomia, caminhoDoNo, type NoTaxonomia, type PropostaTaxonomia } from "./regras_taxonomia.ts";
import { validarTextoSeo, type BaseSeo } from "./regras_seo.ts";

// Dados SINTÉTICOS de teste (SKU, códigos e fontes fictícios). Os nomes de veículo só servem de exemplo de formato.
const L = "aaaaaaaa-0000-0000-0000-000000000001", HOJE = "2026-11-01";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const produto = (): ProdutoTecnico => ({ loja_id: L, sku: "FIX-APL-1", oem: ["FIX-OEM-100"], fabricante: ["FAB-200"], marca_tipo: "desconhecido" });
const fonteCat = (): Fonte => ({ tipo: "catalogo_fabricante", url: "https://fabricante.example/catalogo/200", data: "2026-10-30" });
const prop = (): PropostaAplicacao => ({ loja_id: L, sku: "FIX-APL-1", base: "versao_do_veiculo", fontes: [fonteCat()],
  veiculo: { marca: "Hyundai", modelo: "HR", motor: "2.5 D4CB", ano_inicial: 2013, ano_final: 2017, tipo_ano: "comercializacao_brasil", regime: "importado" } });
const propor: Contexto = { acao: "propor", ator: "agente", hoje: HOJE }, aprovar: Contexto = { acao: "aprovar", ator: "usuario", hoje: HOJE }, publicar: Contexto = { acao: "publicar", ator: "usuario", hoje: HOJE };
const cods = (r: { bloqueios: { codigo: string }[] }) => r.bloqueios.map((b) => b.codigo);

// ───────── Aplicação
test("aplicação: versão completa com fonte forte datada passa e é 'confirmável'", () => {
  const r = validarAplicacao(prop(), produto(), propor);
  assert.deepEqual(cods(r), []); assert.equal(r.nivel, "confirmavel");
  assert.equal(validarAplicacao(prop(), produto(), aprovar).ok, true);
});
test("aplicação: só o motor, só o modelo ou só 'similar' não provam nada", () => {
  const m = prop(); m.base = "somente_motor";
  assert.ok(cods(validarAplicacao(m, produto(), propor)).includes("motor_nao_prova_aplicacao"));
  const d = prop(); d.base = "somente_modelo";
  assert.ok(cods(validarAplicacao(d, produto(), propor)).includes("modelo_sem_versao"));
  const s = prop(); s.base = "referencia_cruzada_similar";
  assert.equal(validarAplicacao(s, produto(), propor).ok, true);                      // como hipótese, com aviso
  assert.equal(validarAplicacao(s, produto(), propor).nivel, "hipotese");
  assert.ok(cods(validarAplicacao(s, produto(), aprovar)).includes("similar_nao_prova_equivalencia"));
  assert.ok(cods(validarAplicacao(s, produto(), publicar)).includes("similar_nao_prova_equivalencia"));
});
test("aplicação: versão incompleta, ano inválido e veículos misturados são bloqueados", () => {
  const a = prop(); a.veiculo.motor = ""; assert.ok(cods(validarAplicacao(a, produto(), propor)).includes("versao_incompleta"));
  const b = prop(); b.veiculo.ano_inicial = null; assert.ok(cods(validarAplicacao(b, produto(), propor)).includes("ano_inicial_invalido"));
  const c = prop(); c.veiculo.ano_final = null; assert.ok(cods(validarAplicacao(c, produto(), propor)).includes("ano_final_ausente"));
  const d = prop(); d.veiculo.ano_final = null; d.veiculo.em_producao = true; assert.ok(!cods(validarAplicacao(d, produto(), propor)).includes("ano_final_ausente"));
  const e = prop(); e.veiculo.ano_inicial = 2017; e.veiculo.ano_final = 2013; assert.ok(cods(validarAplicacao(e, produto(), propor)).includes("anos_invertidos"));
  const f = prop(); f.veiculo.ano_inicial = 2040; f.veiculo.ano_final = 2041; assert.ok(cods(validarAplicacao(f, produto(), propor)).includes("ano_futuro"));
  for (const modelo of ["HR / Bongo K2500", "HR, K2500", "HR e K2500", "HR + K2500", "HR a 2017 e K2500"]) {
    const g = prop(); g.veiculo.modelo = modelo; assert.ok(cods(validarAplicacao(g, produto(), propor)).includes("veiculos_misturados"), modelo);
  }
});
test("aplicação: o ano precisa dizer o que significa e lançamento mundial não vale", () => {
  const a = prop(); a.veiculo.tipo_ano = null; assert.ok(cods(validarAplicacao(a, produto(), propor)).includes("tipo_ano_ausente"));
  const b = prop(); b.veiculo.tipo_ano = "lancamento_mundial"; assert.ok(cods(validarAplicacao(b, produto(), propor)).includes("ano_lancamento_mundial_nao_vale"));
  const c = prop(); c.veiculo.regime = null; const r = validarAplicacao(c, produto(), propor); assert.equal(r.ok, true); assert.match(r.avisos.join(" "), /Regime de montagem/);
});
test("aplicação: sem fonte, sem data, data futura, URL http ou documento curto são bloqueados", () => {
  const a = prop(); a.fontes = []; assert.ok(cods(validarAplicacao(a, produto(), propor)).includes("fonte_ausente"));
  const b = prop(); b.fontes = [{ ...fonteCat(), data: "ontem" }]; assert.ok(cods(validarAplicacao(b, produto(), propor)).includes("fonte_ausente"));
  const c = prop(); c.fontes = [{ ...fonteCat(), data: "2027-01-01" }]; assert.ok(cods(validarAplicacao(c, produto(), propor)).includes("data_da_fonte_invalida"));
  const d = prop(); d.fontes = [{ ...fonteCat(), url: "http://fabricante.example/x" }]; assert.ok(cods(validarAplicacao(d, produto(), propor)).includes("fonte_ausente"));
  const e = prop(); e.fontes = [{ tipo: "outra", documento: "ab", data: "2026-10-30" }]; assert.ok(cods(validarAplicacao(e, produto(), propor)).includes("fonte_ausente"));
  const f = prop(); f.fontes = [{ ...fonteCat(), data: "2026-02-30" }]; assert.ok(cods(validarAplicacao(f, produto(), propor)).includes("fonte_ausente"), "data inexistente");
});
test("aplicação: fonte fraca (anúncio, nota, distribuidor) vira hipótese ao propor e é barrada ao aprovar/publicar", () => {
  for (const tipo of ["anuncio_marketplace", "nota_fiscal", "catalogo_distribuidor", "outra"] as const) {
    const p = prop(); p.fontes = [{ tipo, url: "https://loja.example/anuncio/1", data: "2026-10-30" }];
    const r = validarAplicacao(p, produto(), propor); assert.equal(r.ok, true, tipo); assert.equal(r.nivel, "hipotese", tipo);
    assert.ok(cods(validarAplicacao(p, produto(), aprovar)).includes("sem_fonte_forte"), tipo);
    assert.ok(cods(validarAplicacao(p, produto(), publicar)).includes("sem_fonte_forte"), tipo);
  }
});
test("aplicação: cruzamento por código só vale se o código conferido é do produto", () => {
  const ok = prop(); ok.fontes = [{ tipo: "cruzamento_codigo_oem", documento: "catálogo X p.4", data: "2026-10-30", codigo_conferido: "fix oem 100" }];
  assert.equal(validarAplicacao(ok, produto(), aprovar).ok, true);                     // normaliza caixa, espaços e hífens
  const errado = prop(); errado.fontes = [{ tipo: "cruzamento_codigo_oem", documento: "catálogo X p.4", data: "2026-10-30", codigo_conferido: "OUTRO-999" }];
  assert.ok(cods(validarAplicacao(errado, produto(), propor)).includes("codigo_diverge"));
  const vazio = prop(); vazio.fontes = [{ tipo: "cruzamento_codigo_oem", documento: "catálogo X p.4", data: "2026-10-30" }];
  assert.ok(cods(validarAplicacao(vazio, produto(), propor)).includes("codigo_nao_informado"));
  const semCod = produto(); semCod.oem = []; semCod.fabricante = [];
  assert.ok(cods(validarAplicacao(ok, semCod, propor)).includes("produto_sem_codigo_tecnico"));
  assert.equal(fonteForte(ok.fontes[0], produto(), HOJE), true); assert.equal(fonteForte(errado.fontes[0], produto(), HOJE), false);
});
test("aplicação: o agente nunca aprova nem publica; loja e SKU diferentes são bloqueados", () => {
  for (const acao of ["aprovar", "publicar"] as const) assert.ok(cods(validarAplicacao(prop(), produto(), { acao, ator: "agente", hoje: HOJE })).includes("agente_nao_aprova"), acao);
  const p = prop(); p.loja_id = "bbbbbbbb-0000-0000-0000-000000000002"; assert.ok(cods(validarAplicacao(p, produto(), propor)).includes("loja_diferente"));
  const q = prop(); q.sku = "OUTRO"; assert.ok(cods(validarAplicacao(q, produto(), propor)).includes("sku_diferente"));
});
test("aplicação: peça de reposição não pode ser declarada genuína", () => {
  const pr = produto(); pr.marca_tipo = "reposicao";
  const p = prop(); p.declara_genuina = true;
  assert.ok(cods(validarAplicacao(p, pr, propor)).includes("reposicao_nao_e_genuina"));
  const m = prop(); m.fontes = [{ tipo: "manual_montadora", documento: "manual da montadora p.9", data: "2026-10-30" }];
  assert.match(validarAplicacao(m, pr, propor).avisos.join(" "), /manual da montadora cita o veículo/);
});

// ───────── Intercambiabilidade
test("intercambiabilidade: similar e substituto nunca são aprovados como equivalentes", () => {
  for (const relacao of ["similar", "substituto"] as const) {
    const c = { loja_id: L, sku: "FIX-APL-1", de: "FIX-OEM-100", para: "ZZ-1", relacao, fontes: [fonteCat()], medidas_conferidas: true };
    assert.equal(validarIntercambiabilidade(c, produto(), propor).nivel, "hipotese", relacao);
    assert.ok(cods(validarIntercambiabilidade(c, produto(), aprovar)).includes("similar_nao_prova_equivalencia"), relacao);
  }
});
test("intercambiabilidade: equivalência confirmada exige fonte forte e medidas conferidas", () => {
  const c = { loja_id: L, sku: "FIX-APL-1", de: "FIX-OEM-100", para: "ZZ-1", relacao: "equivalente" as const, fontes: [fonteCat()], medidas_conferidas: true };
  assert.equal(validarIntercambiabilidade(c, produto(), aprovar).ok, true); assert.equal(validarIntercambiabilidade(c, produto(), aprovar).nivel, "confirmavel");
  assert.ok(cods(validarIntercambiabilidade({ ...c, medidas_conferidas: false }, produto(), aprovar)).includes("medidas_nao_conferidas"));
  assert.ok(cods(validarIntercambiabilidade({ ...c, fontes: [{ tipo: "anuncio_marketplace", url: "https://x.example/a", data: "2026-10-30" }] }, produto(), aprovar)).includes("sem_fonte_forte"));
  assert.ok(cods(validarIntercambiabilidade({ ...c, para: "fix-oem-100" }, produto(), propor)).includes("codigos_iguais"));
  assert.ok(cods(validarIntercambiabilidade({ ...c, fontes: [] }, produto(), propor)).includes("fonte_ausente"));
  assert.ok(cods(validarIntercambiabilidade(c, produto(), { acao: "aprovar", ator: "agente", hoje: HOJE })).includes("agente_nao_aprova"));
});

// ───────── Taxonomia
const arvore = (): NoTaxonomia[] => [
  { id: "r", pai_id: null, nome: "Motor", slug: "motor", perfil_ramo: "autopecas", status: "aprovado" },
  { id: "c", pai_id: "r", nome: "Correias e tensores", slug: "correias-tensores", perfil_ramo: "autopecas", status: "aprovado" },
  { id: "k", pai_id: "c", nome: "Correia dentada", slug: "correia-dentada", perfil_ramo: "autopecas", status: "proposto" },
  { id: "o", pai_id: "r", nome: "Bombas de óleo", slug: "bombas-oleo", perfil_ramo: "autopecas", status: "aprovado" },
  { id: "x", pai_id: null, nome: "Roupas", slug: "roupas", perfil_ramo: "moda", status: "aprovado" },
];
const pt = (over: Partial<PropostaTaxonomia> = {}): PropostaTaxonomia => ({ loja_id: L, sku: "FIX-APL-1", produto: { loja_id: L, sku: "FIX-APL-1", perfil_ramo: "autopecas" }, no_id: "o", fundamento: "ponte_bling_homologada", ...over });
test("taxonomia: nó aprovado, da árvore certa, com fundamento real, passa", () => {
  const r = validarTaxonomia(pt(), arvore(), { acao: "aprovar", ator: "usuario" });
  assert.deepEqual(cods(r), []); assert.deepEqual(r.caminho, ["Motor", "Bombas de óleo"]);
});
test("taxonomia: nó inexistente, de outro ramo ou com caminho quebrado/ciclo é bloqueado", () => {
  assert.ok(cods(validarTaxonomia(pt({ no_id: "nao-existe" }), arvore(), { acao: "propor", ator: "agente" })).includes("no_inexistente"));
  assert.ok(cods(validarTaxonomia(pt({ no_id: null }), arvore(), { acao: "propor", ator: "agente" })).includes("no_inexistente"));
  assert.ok(cods(validarTaxonomia(pt({ no_id: "x" }), arvore(), { acao: "propor", ator: "agente" })).includes("perfil_diferente"));
  const orfao = arvore(); orfao.push({ id: "z", pai_id: "sumiu", nome: "Z", slug: "z", perfil_ramo: "autopecas", status: "aprovado" });
  assert.ok(cods(validarTaxonomia(pt({ no_id: "z" }), orfao, { acao: "propor", ator: "agente" })).includes("caminho_quebrado"));
  const ciclo = arvore().map((n) => (n.id === "r" ? { ...n, pai_id: "o" } : n));
  assert.ok(cods(validarTaxonomia(pt({ no_id: "o" }), ciclo, { acao: "propor", ator: "agente" })).includes("caminho_quebrado"));
  assert.equal(caminhoDoNo("o", ciclo).completo, false);
});
test("taxonomia: nó só proposto vale como hipótese ao propor, mas não para aprovar/publicar; ancestral não aprovado também barra", () => {
  const r = validarTaxonomia(pt({ no_id: "k" }), arvore(), { acao: "propor", ator: "agente" });
  assert.equal(r.ok, true); assert.match(r.avisos.join(" "), /não homologado/);
  assert.ok(cods(validarTaxonomia(pt({ no_id: "k" }), arvore(), { acao: "aprovar", ator: "usuario" })).includes("no_nao_homologado"));
  assert.ok(cods(validarTaxonomia(pt({ no_id: "k" }), arvore(), { acao: "publicar", ator: "usuario" })).includes("no_nao_homologado"));
  const anc = arvore().map((n) => (n.id === "c" ? { ...n, status: "proposto" as const } : n.id === "k" ? { ...n, status: "aprovado" as const } : n));
  assert.ok(cods(validarTaxonomia(pt({ no_id: "k" }), anc, { acao: "aprovar", ator: "usuario" })).includes("ancestral_nao_homologado"));
});
test("taxonomia: 'o nome parece' não basta para aprovar; sem fundamento nem para propor", () => {
  assert.equal(validarTaxonomia(pt({ fundamento: "semelhanca_do_nome" }), arvore(), { acao: "propor", ator: "agente" }).ok, true);
  assert.ok(cods(validarTaxonomia(pt({ fundamento: "semelhanca_do_nome" }), arvore(), { acao: "aprovar", ator: "usuario" })).includes("fundamento_insuficiente"));
  assert.ok(cods(validarTaxonomia(pt({ fundamento: "nenhum" }), arvore(), { acao: "propor", ator: "agente" })).includes("fundamento_ausente"));
});
test("taxonomia: o agente não cria nó, não aprova nó, não aprova nem publica; loja e SKU diferentes bloqueiam", () => {
  for (const acao of ["criar_no", "aprovar_no", "aprovar", "publicar"] as const) assert.ok(cods(validarTaxonomia(pt(), arvore(), { acao, ator: "agente" })).includes("agente_nao_aprova"), acao);
  assert.ok(cods(validarTaxonomia(pt({ loja_id: "outra" }), arvore(), { acao: "propor", ator: "agente" })).includes("loja_diferente"));
  assert.ok(cods(validarTaxonomia(pt({ sku: "OUTRO" }), arvore(), { acao: "propor", ator: "agente" })).includes("sku_diferente"));
  assert.match(validarTaxonomia(pt({ no_id: "c" }), arvore(), { acao: "propor", ator: "agente" }).avisos.join(" "), /subnós/);
});

// ───────── Texto SEO
const base = (): BaseSeo => ({ sku: "FIX-APL-1", codigosAprovados: ["FIX-OEM-100", "FAB-200"], aplicacoesAprovadas: [{ marca: "Hyundai", modelo: "HR", motor: "2.5 D4CB", ano_inicial: 2013, ano_final: 2017 }, { marca: "Kia", modelo: "Bongo K2500", motor: "2.5 D4CB", ano_inicial: 2013, ano_final: 2016 }] });
const seoOk = (t: string, b = base()) => validarTextoSeo(t, b);
test("SEO: texto que cita só aplicações, anos e códigos aprovados passa", () => {
  assert.deepEqual(seoOk("Bomba de óleo FAB-200, código FIX-OEM-100. Compatível com HR e Bongo K2500, motor 2.5 D4CB, 2013 a 2016.").bloqueios, []);
  assert.equal(seoOk("Bomba de óleo do SKU FIX-APL-1 para o motor 2.5 D4CB, Euro 5, 2.5 16V.").ok, true);
});
test("SEO: compatibilidade sem aplicação aprovada é bloqueada", () => {
  const vazio = base(); vazio.aplicacoesAprovadas = [];
  assert.ok(cods(seoOk("Serve em Hyundai HR 2013.", vazio)).includes("seo_compatibilidade_sem_aplicacao_aprovada"));
  assert.equal(seoOk("Bomba de óleo de alumínio.", vazio).ok, true);
});
test("SEO: veículo ou ano fora do aprovado é bloqueado", () => {
  assert.ok(cods(seoOk("Compatível com Mitsubishi L200.")).includes("seo_veiculo_nao_aprovado"));
  assert.ok(cods(seoOk("Compatível com HR e Pajero.")).includes("seo_veiculo_nao_aprovado"));
  assert.ok(cods(seoOk("Compatível com HR 2010.")).includes("seo_ano_fora_do_aprovado"));
  assert.ok(cods(seoOk("Serve em HR 2013 a 2020.")).includes("seo_ano_fora_do_aprovado"));
});
test("SEO: código que não é do produto é bloqueado; SKU, modelos e anos não são tomados por código", () => {
  assert.ok(cods(seoOk("Equivale ao código ZZ-98765.")).includes("seo_codigo_nao_aprovado"));
  assert.ok(cods(seoOk("Referência 20910-4AU07 do catálogo.")).includes("seo_codigo_nao_aprovado"));
  assert.equal(seoOk("Compatível com Bongo K2500 2013-2016, motor D4CB 2.5.").ok, true);
});
test("SEO: 'original', 'genuína', 'homologada' ou 'certificada' sem prova é bloqueado", () => {
  for (const t of ["Peça original.", "Bomba genuína Hyundai.", "Produto homologado.", "Peça certificada."]) assert.ok(cods(seoOk(t)).includes("seo_afirma_originalidade_sem_prova"), t);
  assert.equal(seoOk("Peça original.", { ...base(), genuinaProvada: true }).ok, true);
});

test("SEO: motor se reconhece pelo código em qualquer ordem, mas palavra genérica não vale como veículo aprovado", () => {
  assert.equal(seoOk("Compatível com motor D4CB 2.5.").ok, true);
  assert.ok(cods(seoOk("Compatível com motor diesel.")).includes("seo_veiculo_nao_aprovado"));
  assert.ok(cods(seoOk("Compatível com motor 2.5.")).includes("seo_veiculo_nao_aprovado"));
  assert.ok(cods(seoOk("Compatível com motor D4BH.")).includes("seo_veiculo_nao_aprovado"));
});

test("SEO: faixa de anos escrita de vários jeitos é reconhecida e conferida contra o aprovado", () => {
  for (const ok of ["Compatível com HR, de 2013 a 2017.", "Compatível com HR a partir de 2013.", "Compatível com HR entre 2014 e 2016.", "Compatível com HR 2013-2017."]) assert.equal(seoOk(ok).ok, true, ok);
  for (const ruim of ["Compatível com HR, de 2008 a 2017.", "Compatível com HR a partir de 2005.", "Compatível com HR, de 2013 a 2025."]) assert.ok(cods(seoOk(ruim)).includes("seo_ano_fora_do_aprovado"), ruim);
});
