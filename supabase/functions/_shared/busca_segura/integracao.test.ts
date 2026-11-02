// Integração PR #242: as ferramentas EXISTENTES (engenharia.consulta.interpretar e conecta.imagem.buscar_web) usam os módulos novos. Sem rede nem banco (fetch e rpc simulados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDLERS } from "../conector/handlers.ts";

const vocab = { modelos: [{ montadora: "Hyundai", modelo: "HR", categoria: "caminhao", versoes: ["2.5 8V", "2.5 16V"] }], pecas: [{ slug: "junta", nome: "Junta do cabeçote" }] };
const glossario = { termos: [
  { codigo: "4D56", valvulas: 8, aplicacoes: [{ montadora: "Hyundai", modelo: "HR", de: 2005, ate: 2012 }] },
  { codigo: "D4CB", valvulas: 16, aplicacoes: [{ montadora: "Hyundai", modelo: "HR", de: 2007 }] },
] };
const ctxInterpretar = (g: "ok" | "erro" | "nulo") => ({ rpc: async (fn: string) => {
  if (fn === "vocabulario_de_busca") return { data: vocab, error: null };
  if (g === "erro") return { data: null, error: { message: "função não existe" } };
  return { data: g === "nulo" ? null : glossario, error: null };
} }) as any;

test("engenharia.consulta.interpretar: 'HR 2008' devolve pergunta e motor NÃO verificado, mantendo os campos antigos", async () => {
  const r = await HANDLERS["engenharia.consulta.interpretar"]({ texto: "junta do cabeçote do HR 2008" }, ctxInterpretar("ok")) as any;
  assert.equal(r.veiculo.ano, 2008); assert.equal(r.ano_e_motor, false);
  assert.equal(r.motor.verificado, false); assert.equal(r.motor.ambiguo, true);
  assert.ok(r.perguntas.some((p: string) => /código do motor/.test(p)));
  assert.ok(Array.isArray(r.falta) && Array.isArray(r.pecas), "campos antigos preservados");
});
test("engenharia.consulta.interpretar: glossário ausente ou com erro -> falha fechada: nenhum motor presumido, com aviso", async () => {
  for (const g of ["erro", "nulo"] as const) {
    const r = await HANDLERS["engenharia.consulta.interpretar"]({ texto: "junta do HR 2008" }, ctxInterpretar(g)) as any;
    assert.equal(r.motor.candidatos.length, 0); assert.equal(r.motor.informado, null);
    assert.ok(r.avisos.some((a: string) => /Glossário de motores indisponível/.test(a)), g);
  }
});

const google = (itens: { title: string; link: string; ctx: string }[]) => (async () => new Response(JSON.stringify({ items: itens.map((i) => ({ title: i.title, link: i.link, image: { contextLink: i.ctx, thumbnailLink: i.link } })) }), { status: 200 })) as unknown as typeof fetch;
function ctxImagem(itens: { title: string; link: string; ctx: string }[]) {
  const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [{ tipo: "oem", valor: "20910-4AU07", status: "aprovado" }, { tipo: "similar", valor: "SIM-999", status: "aprovado" }] }) }) }) }) };
  return { lojaId: "L", userId: "u", buscaImagem: { chave: "k", cx: "c" }, fetch: google(itens), admin,
    dados: { verProduto: async (sku: string) => (sku === "JC-1234" ? { sku, gtin: "7891000100103" } : { erro: "Produto não encontrado nesta loja." }), produtoPorSku: async () => ({ id: "p1" }) } } as any;
}
test("conecta.imagem.buscar_web COM sku devolve galeria: nada aprovado, marketplace e sem código ficam pendentes, similar não conta como código", async () => {
  const itens = [
    { title: "Junta cabeçote JC-1234 Sabó", link: "https://fabricante.exemplo.com.br/a.jpg", ctx: "https://fabricante.exemplo.com.br/jc-1234" },
    { title: "Junta HR 2.5 original JC 1234", link: "https://http2.mlstatic.com/b.jpg", ctx: "https://produto.mercadolivre.com.br/MLB-1" },
    { title: "Junta qualquer", link: "https://exemplo.com/c.jpg", ctx: "https://exemplo.com/c" },
    { title: "Junta SIM-999", link: "https://exemplo.com/d.jpg", ctx: "https://exemplo.com/d" },
  ];
  const r = await HANDLERS["conecta.imagem.buscar_web"]({ consulta: "junta JC-1234", sku: "JC-1234" }, ctxImagem(itens)) as any;
  assert.equal(r.galeria.aprovacoes_automaticas, 0);
  assert.ok(r.galeria.itens.every((i: any) => i.aprovada === false && i.publicavel === false));
  const porUrl = Object.fromEntries(r.galeria.itens.map((i: any) => [i.url, i]));
  assert.equal(porUrl["https://http2.mlstatic.com/b.jpg"].evidencia.nivel, "descoberta");
  assert.equal(porUrl["https://exemplo.com/c.jpg"].evidencia, null);
  assert.equal(porUrl["https://exemplo.com/d.jpg"].evidencia, null, "código 'similar' não prova identidade");
  assert.ok(r.galeria.itens.every((i: any) => i.estado !== "aprovavel"), "sem marca d'água/resolução conferidas, nenhuma é aprovável de saída");
});
test("conecta.imagem.buscar_web: sku inexistente -> erro; sem sku -> lista antiga com aviso de direitos", async () => {
  const c = ctxImagem([{ title: "x", link: "https://a.com/1.jpg", ctx: "https://a.com" }]);
  assert.match((await HANDLERS["conecta.imagem.buscar_web"]({ consulta: "x", sku: "NAO-EXISTE" }, c) as any).erro, /não encontrado/);
  const antiga = await HANDLERS["conecta.imagem.buscar_web"]({ consulta: "x" }, c) as any;
  assert.ok(Array.isArray(antiga.candidatas) && /NÃO confirmados/.test(antiga.aviso));
});
test("aceite 8: provedor com 429 vira erro tipado, sem candidatas inventadas", async () => {
  const c = ctxImagem([]); c.fetch = (async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 })) as unknown as typeof fetch;
  const r = await HANDLERS["conecta.imagem.buscar_web"]({ consulta: "x", sku: "JC-1234" }, c) as any;
  assert.equal(r.motivo, "limite"); assert.ok(!r.galeria && !r.candidatas);
});

// ── Investigação técnica pela ferramenta do chat (handler real, provedor simulado)
const googleTecnico = (itens: { title: string; link: string; snippet: string }[], status = 200) => (async () => new Response(JSON.stringify(status === 200 ? { items: itens } : { error: { message: "quota" } }), { status })) as unknown as typeof fetch;
function ctxPesquisa(extra: Record<string, unknown> = {}) {
  const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [{ tipo: "oem", valor: "25100-42000", status: "aprovado" }, { tipo: "similar", valor: "SIM-999", status: "aprovado" }] }) }) }) }) };
  return { lojaId: "L", userId: "u", admin,
    dados: { verProduto: async (sku: string) => (sku === "CI000016" ? { nome: "Bomba d'água TRIM GO HR 2.5 8V", marca: "TRIM GO", gtin: "", preco: 176.77, precoCusto: 110.48, fornecedor: "SECRETO" } : { erro: "Produto não encontrado nesta loja." }), produtoPorSku: async () => ({ id: "p1" }) },
    ...extra } as any;
}
test("engenharia.pesquisa.investigar sem provedor: 'nao_testada', sem inventar e sem escrever", async () => {
  const r = await HANDLERS["engenharia.pesquisa.investigar"]({ sku: "CI000016", motor: "4D56", veiculo: "Hyundai HR" }, ctxPesquisa()) as any;
  assert.equal(r.compatibilidade.status, "nao_testada"); assert.match(r.compatibilidade.mensagem, /APLICAÇÃO NÃO CONFIRMADA/);
  assert.equal(r.sem_escrita, true); assert.equal(r.consultas.length, 0);
});
test("engenharia.pesquisa.investigar com provedor: consultas progressivas, código escrito confirmado, aplicação NÃO confirmada, e nada sensível vai à busca", async () => {
  const consultas: string[] = [];
  const f = (async (url: string) => { consultas.push(decodeURIComponent(new URL(url).searchParams.get("q") ?? "")); return new Response(JSON.stringify({ items: [{ title: "Bomba d'água CI000016 HR", link: "https://loja.exemplo.com.br/p/ci000016", snippet: "Código CI000016 para Hyundai HR 4D56" }] }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await HANDLERS["engenharia.pesquisa.investigar"]({ sku: "CI000016", motor: "4D56", veiculo: "Hyundai HR" }, ctxPesquisa({ buscaImagem: { chave: "k", cx: "c" }, fetch: f })) as any;
  assert.ok(r.consultas.length >= 3 && r.consultas.length <= 6, String(r.consultas.length));
  assert.ok(r.confirmado.some((c: string) => /CI000016 aparece escrito/.test(c)));
  assert.equal(r.compatibilidade.status, "nao_confirmada");
  const tudo = consultas.join("|") + JSON.stringify(r);
  for (const proibido of ["110.48", "SECRETO", "SIM-999"]) assert.ok(!tudo.includes(proibido), proibido);
  assert.ok(consultas.some((q) => q.includes('"25100-42000"')), "OEM aprovado entra na consulta");
});
test("engenharia.pesquisa.investigar: 429 do provedor interrompe e devolve o parcial; SKU inexistente é erro", async () => {
  const r = await HANDLERS["engenharia.pesquisa.investigar"]({ sku: "CI000016" }, ctxPesquisa({ buscaImagem: { chave: "k", cx: "c" }, fetch: googleTecnico([], 429) })) as any;
  assert.equal(r.limites.interrompida_por, "limite"); assert.ok(r.pendencias.some((p: string) => /interrompida/.test(p)));
  assert.match((await HANDLERS["engenharia.pesquisa.investigar"]({ sku: "NAO-EXISTE" }, ctxPesquisa()) as any).erro, /não encontrado/);
  assert.match((await HANDLERS["engenharia.pesquisa.investigar"]({}, ctxPesquisa()) as any).erro, /Informe o SKU/);
});
