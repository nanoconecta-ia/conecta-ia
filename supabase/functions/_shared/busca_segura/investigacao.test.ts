// Investigação técnica (especificação 02/11/2026). Fixtures = resultados REAIS devolvidos pela busca em 02/11/2026 para o CI000016 (docs/evidencias/pesquisa-CI000016-2026-11-02.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { investigar, type OpcoesInvestigacao } from "./investigacao.ts";
import { BuscaErro, type Candidata, type ProvedorBusca, type ResultadoTecnico } from "../ia/busca.ts";
import type { DadosProduto } from "./plano_pesquisa.ts";

const HOJE = "2026-11-02";
const produto: DadosProduto = { sku: "CI000016", oem: [], gtin: null, marca: "TRIM GO AUTOPARTS", descricao: "Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas", peca: "bomba d'água", motor: "4D56", veiculo: "HR", categoria: "arrefecimento" };
const REAIS: ResultadoTecnico[] = [
  { titulo: "BOMBA DAGUA HR/K2500/ 2.5 8V EURO III \\12 D4BH/D4BB/4D56", pagina: "https://quatrodistribuidora.com.br/produto/bomba-dagua-hr-k2500-2-5-8v-euro-iii-12-d4bh-d4bb-4d56/", resumo: "SKU: CI000016 Categorias: Bombas D'água, Motor. Aplicação: HR/K2500/ 2.5 8V EURO III D4BH/D4BB/4D56", fonte: "quatrodistribuidora.com.br" },
  { titulo: "Bomba d'água Trim-go- Hyundai HR 8v / Hyundai H100 / Kia Bongo K2500 8v [CI000016]", pagina: "https://www.importvans.com.br/arrefecimento/bomba-d-agua-trim-go-hyundai-hr-8v-ci000016", resumo: "", fonte: "importvans.com.br" },
  { titulo: "Bomba D'água Completa L200 Gl/gls 95/05 H100 93/00 2.5 8v", pagina: "https://produto.mercadolivre.com.br/MLB-5770409210-bomba-dagua-completa-l200", resumo: "Aplicação H100 96/00 motor 4D56 8V", fonte: "mercadolivre.com.br" },
];
const IMAGENS_REAIS: Candidata[] = [
  { titulo: "Bomba D'água Trim-go Ci000016 Hyundai Hr /kia K2500 Ate 2012 | MercadoLivre", url: "https://http2.mlstatic.com/D_NQ_NP_814353-MLB112535133162_062026-O.webp", miniatura: null, pagina: "https://www.mercadolivre.com.br/bomba-dagua-trimgo-ci000016-hyundai-hr-kia-k2500-ate-2012/up/MLBU4157918216" },
  { titulo: "Bomba D'água Trim-go Ci000016 Hyundai Hr /kia K2500 Ate 2012 | MercadoLivre", url: "https://http2.mlstatic.com/D_NQ_NP_759351-MLB112535162744_062026-O.webp", miniatura: null, pagina: "https://www.mercadolivre.com.br/bomba-dagua-trimgo-ci000016-hyundai-hr-kia-k2500-ate-2012/up/MLBU4157918216" },
];
function provedor(p: Partial<ProvedorBusca> & { chamadas?: string[] } = {}): ProvedorBusca & { chamadas: string[] } {
  const chamadas = p.chamadas ?? [];
  return { id: "teste", chamadas, imagens: p.imagens ?? (async (q) => { chamadas.push("img:" + q); return IMAGENS_REAIS; }), tecnico: p.tecnico ?? (async (q) => { chamadas.push("web:" + q); return REAIS; }) };
}
const base = (pv: ProvedorBusca | null, extra: Partial<OpcoesInvestigacao> = {}): OpcoesInvestigacao => ({ produto, codigos: ["CI000016"], hoje: HOJE, provedor: pv, ...extra });

test("caso real CI000016 sem domínios verificados: o código é CONFIRMADO como escrito, mas a aplicação fica NÃO CONFIRMADA e não há fonte oficial", async () => {
  const r = await investigar(base(provedor()));
  assert.equal(r.compatibilidade.status, "nao_confirmada"); assert.match(r.compatibilidade.mensagem, /APLICAÇÃO NÃO CONFIRMADA/);
  assert.ok(r.confirmado.some((c) => /CI000016 aparece escrito em 2 página/.test(c) && /quatrodistribuidora\.com\.br/.test(c)));
  assert.ok(r.nao_encontrado.some((n) => /Nenhuma fonte de fabricante, montadora ou distribuidor autorizado/.test(n)));
  assert.ok(r.nao_encontrado.some((n) => /OEM confirmado/.test(n)));
  assert.ok(r.nao_testado.some((n) => /licença/.test(n)) && r.nao_testado.some((n) => /dentro da fotografia/.test(n)));
  assert.equal(r.sem_escrita, true);
});
test("a página que traz apenas o motor 4D56 SEM o código (marketplace de outra peça) não vira evidência", async () => {
  const r = await investigar(base(provedor()));
  assert.ok(!r.fontes.some((f) => /MLB-5770409210/.test(f.url)));
});
test("galeria da investigação: até 8, nenhuma aprovada, e marketplace só como pista", async () => {
  const r = await investigar(base(provedor()));
  assert.ok(r.galeria.itens.length > 0 && r.galeria.itens.length <= 8);
  assert.equal(r.galeria.aprovacoes_automaticas, 0);
  assert.ok(r.galeria.itens.every((i) => i.estado !== "aprovavel" && i.aprovada === false && i.publicavel === false));
  assert.ok(r.galeria.itens.every((i) => i.evidencia?.nivel === "descoberta"));
});
test("com o domínio do distribuidor VERIFICADO por uma pessoa e contexto de aplicação, a aplicação sai como sustentada por fonte forte (a pessoa ainda aprova)", async () => {
  const r = await investigar(base(provedor(), { dominios: { "quatrodistribuidora.com.br": "distribuidor_b2b" } }));
  assert.equal(r.compatibilidade.status, "confirmada"); assert.match(r.compatibilidade.mensagem, /A pessoa ainda aprova/);
  assert.ok(r.fontes.find((f) => f.host === "quatrodistribuidora.com.br" && f.nivel === "forte" && f.com_contexto_de_aplicacao));
});
test("sem provedor: NÃO TESTADA, sem inventar nada", async () => {
  const r = await investigar(base(null));
  assert.equal(r.compatibilidade.status, "nao_testada"); assert.equal(r.consultas.length, 0); assert.equal(r.fontes.length, 0);
  assert.ok(r.nao_testado.some((n) => /nenhum provedor de busca/.test(n))); assert.equal(r.limites.interrompida_por, "sem_provedor");
});
test("429 interrompe a pesquisa e devolve o parcial, sem inventar", async () => {
  const pv = provedor({ tecnico: async () => { throw new BuscaErro(429, "limite", "limite de buscas"); } });
  const r = await investigar(base(pv));
  assert.equal(r.limites.interrompida_por, "limite"); assert.equal(r.compatibilidade.status, "nao_confirmada");
  assert.ok(r.consultas[0].erro?.startsWith("limite")); assert.ok(r.pendencias.some((p) => /interrompida/.test(p)));
});
test("falha isolada (5xx) não derruba a investigação: as demais consultas seguem", async () => {
  let n = 0;
  const pv = provedor({ tecnico: async () => { n++; if (n === 1) throw new BuscaErro(502, "erro_provedor", "HTTP 503"); return REAIS; } });
  const r = await investigar(base(pv, { orcamento: { max_consultas: 6, max_por_etapa: 2 } }));
  assert.ok(r.consultas.some((c) => c.erro) && r.consultas.some((c) => !c.erro && c.resultados > 0));
  assert.equal(r.limites.interrompida_por, null);
});
test("resposta inesperada do provedor (não é lista) vira erro registrado, não dado", async () => {
  const pv = provedor({ tecnico: (async () => "<html>Acesso negado</html>") as unknown as ProvedorBusca["tecnico"] });
  const r = await investigar(base(pv));
  assert.ok(r.consultas.every((c) => c.alvo === "imagens" || c.erro)); assert.equal(r.fontes.length, 0);
});
test("o orçamento limita as chamadas ao provedor", async () => {
  const pv = provedor();
  await investigar(base(pv, { orcamento: { max_consultas: 2, max_por_etapa: 2 } }));
  assert.ok(pv.chamadas.length <= 2, String(pv.chamadas.length));
});
test("cache: repetir a mesma investigação não chama o provedor de novo", async () => {
  const pv = provedor(), cache = new Map<string, unknown>();
  await investigar(base(pv, { cache })); const antes = pv.chamadas.length;
  const r2 = await investigar(base(pv, { cache }));
  assert.equal(pv.chamadas.length, antes); assert.equal(r2.limites.consultas_usadas, 0); assert.ok(r2.consultas.every((c) => c.do_cache));
});
test("timeout por consulta falha fechado (a consulta registra erro e a investigação termina)", async () => {
  const pv = provedor({ tecnico: () => new Promise(() => {}), imagens: () => new Promise(() => {}) });
  const r = await investigar(base(pv, { timeoutMs: 20, orcamento: { max_consultas: 2, max_por_etapa: 2 } }));
  assert.ok(r.consultas.every((c) => /timeout/.test(c.erro ?? ""))); assert.equal(r.fontes.length, 0);
});
test("sem evidência alguma e com sinônimos fornecidos, reformula dentro do orçamento", async () => {
  const pv = provedor({ tecnico: async (q) => { pv.chamadas.push("web:" + q); return []; } });
  const r = await investigar(base(pv, { sinonimos: { "bomba d'agua": ["water pump"] }, orcamento: { max_consultas: 8, max_por_etapa: 2 } }));
  assert.ok(r.consultas.some((c) => c.etapa === "reformulacao" && /water pump/.test(c.texto)));
  assert.ok(r.nao_encontrado.some((n) => /Nenhuma página em que algum código/.test(n)));
});
test("só marketplace como fonte: nunca confirma aplicação", async () => {
  const pv = provedor({ tecnico: async () => [REAIS[2], { ...REAIS[1], pagina: "https://produto.mercadolivre.com.br/MLB-1-x" }] });
  const r = await investigar(base(pv));
  assert.equal(r.compatibilidade.status, "nao_confirmada"); assert.ok(r.fontes.every((f) => f.nivel !== "forte"));
});

// ── Política de domínio/origem pública (regra do dono, 02/11/2026)
test("referências: só o fabricante verificado da PRÓPRIA marca vira origem pública; distribuidor e marketplace ficam como referência técnica interna", async () => {
  const registro = [
    { dominio: "fabricante-teste.exemplo", entidade: "Fabricante Teste", marcas: ["TRIM GO"], tipo: "fabricante" as const, status: "verificado" as const },
    { dominio: "quatrodistribuidora.com.br", entidade: "Distribuidora", marcas: ["TRIM GO"], tipo: "distribuidor" as const, status: "verificado" as const },
  ];
  const pv = provedor({ tecnico: async () => [...REAIS, { titulo: "Bomba CI000016 HR", pagina: "https://www.fabricante-teste.exemplo/p/ci000016", resumo: "código CI000016", fonte: "x" }] });
  const r = await investigar(base(pv, { registroDominios: registro }));
  assert.equal(r.referencias.publicas.length, 1); assert.equal(r.referencias.publicas[0].host, "fabricante-teste.exemplo");
  assert.match(r.referencias.publicas[0].texto, /^Fabricante: TRIM GO AUTOPARTS\. Origem e garantia do fabricante: https:\/\/www\.fabricante-teste\.exemplo\/p\/ci000016$/);
  const internas = r.referencias.internas.map((i) => i.host);
  assert.ok(internas.includes("quatrodistribuidora.com.br") && internas.includes("importvans.com.br"));
  assert.ok(!JSON.stringify(r.referencias.publicas).includes("quatrodistribuidora") && !JSON.stringify(r.referencias.publicas).includes("mercadolivre"));
  assert.ok(r.fontes.filter((f) => f.publico).length === 1 && r.fontes.every((f) => f.papel === "origem_do_fabricante" || f.papel === "referencia_tecnica"));
});
test("sem registro de domínios nenhuma referência é pública (tudo fica interno)", async () => {
  const r = await investigar(base(provedor()));
  assert.equal(r.referencias.publicas.length, 0); assert.ok(r.referencias.internas.length > 0); assert.ok(r.fontes.every((f) => f.publico === false));
});
