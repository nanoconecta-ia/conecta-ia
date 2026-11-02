// Testes de aceite 8 e 12 do PR #242.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classeDaFonte, hashTrecho, lerRespostaFonte, melhorFonte, provaCompatibilidade, situacaoDoCache, validarEvidencia, type EvidenciaBusca } from "./evidencia.ts";

const HOJE = "2026-11-02";
const alvo = { codigos: ["JC-1234", "7891000100103"] };
const ev = async (p: Partial<EvidenciaBusca> = {}): Promise<EvidenciaBusca> => {
  const trecho = p.trecho ?? "Junta do cabeçote JC-1234 para Hyundai HR 2.5 8V (2005-2012)";
  return { url: "https://fabricante.exemplo.com.br/catalogo/jc-1234", titulo: "Catálogo", editor: "Fabricante", coletada_em: "2026-11-01", trecho, codigo_exato: "JC-1234",
    contexto_aplicacao: "Hyundai HR 2.5 8V 2005-2012", sha256: await hashTrecho(trecho), confianca: 0.9, classe: "fabricante_oficial", ...p };
};

test("aceite 12: evidência completa (URL, código, data, hash, contexto) é forte", async () => {
  const r = validarEvidencia(await ev(), alvo, HOJE);
  assert.equal(r.nivel, "forte"); assert.ok(r.ok, JSON.stringify(r));
  assert.equal((await ev()).sha256.length, 64);
});
test("aceite 12: marketplace nunca prova compatibilidade sozinho", async () => {
  const m = await ev({ url: "https://produto.mercadolivre.com.br/MLB-1", classe: classeDaFonte("https://produto.mercadolivre.com.br/MLB-1") });
  assert.equal(m.classe, "marketplace");
  const r = validarEvidencia(m, alvo, HOJE);
  assert.equal(r.nivel, "descoberta"); assert.ok(r.avisos.some((a) => /não prova compatibilidade/.test(a)));
  assert.equal(provaCompatibilidade([m], alvo, HOJE).prova, false);
  assert.equal(provaCompatibilidade([m, await ev()], alvo, HOJE).prova, true, "com fonte forte e aplicação, a prova vem da forte");
});
test("aceite 12: trecho sem o código exato, código alheio, data futura, sem https e hash ruim são rejeitados", async () => {
  assert.equal(validarEvidencia(await ev({ trecho: "Junta de cabeçote para HR" }), alvo, HOJE).nivel, "rejeitada");
  assert.equal(validarEvidencia(await ev({ trecho: "peça JC-12345 compatível" }), alvo, HOJE).nivel, "rejeitada", "JC-1234 não vale dentro de JC-12345");
  assert.equal(validarEvidencia(await ev({ codigo_exato: "ZZ-9" , trecho: "peça ZZ-9"}), alvo, HOJE).nivel, "rejeitada");
  assert.equal(validarEvidencia(await ev({ coletada_em: "2027-01-01" }), alvo, HOJE).nivel, "rejeitada");
  assert.equal(validarEvidencia(await ev({ url: "http://x.com/a" }), alvo, HOJE).nivel, "rejeitada");
  assert.equal(validarEvidencia(await ev({ sha256: "abc" }), alvo, HOJE).nivel, "rejeitada");
});
test("aceite 12: evidência forte sem contexto de aplicação prova o código, não o veículo", async () => {
  const e = await ev({ contexto_aplicacao: null });
  assert.equal(validarEvidencia(e, alvo, HOJE).nivel, "forte");
  assert.equal(provaCompatibilidade([e], alvo, HOJE).prova, false);
});
test("prioridade: fabricante > B2B > documentação > marketplace", async () => {
  const lista = [await ev({ classe: "marketplace", confianca: 0.99 }), await ev({ classe: "distribuidor_b2b" }), await ev({ classe: "fabricante_oficial", confianca: 0.5 })];
  assert.equal(melhorFonte(lista)!.classe, "fabricante_oficial");
  assert.equal(classeDaFonte("https://dist.exemplo.com/x", { "dist.exemplo.com": "distribuidor_b2b" }), "distribuidor_b2b");
  assert.equal(classeDaFonte("não é url"), "outra");
});
test("aceite 8: 429, 5xx, 403, vazia, HTML onde se esperava JSON, JSON quebrado e resposta enorme falham fechado, sem texto", () => {
  assert.deepEqual(lerRespostaFonte({ status: 429, corpo: "x" }).ok, false);
  for (const [status, motivo] of [[429, "limite_de_requisicoes"], [500, "indisponivel"], [503, "indisponivel"], [403, "bloqueada"], [404, "indisponivel"]] as const) {
    const r = lerRespostaFonte({ status, corpo: "{}" }); assert.ok(!r.ok && r.motivo === motivo, `${status}`);
  }
  const casos: [{ status: number; contentType?: string; corpo: string | null }, string][] = [
    [{ status: 200, corpo: "  " }, "vazia"], [{ status: 200, corpo: null }, "vazia"],
    [{ status: 200, contentType: "text/html", corpo: "<html><body>Acesso negado</body></html>" }, "formato_inesperado"],
    [{ status: 200, corpo: "<!DOCTYPE html><p>x</p>" }, "formato_inesperado"], [{ status: 200, corpo: "{quebrado" }, "formato_inesperado"],
    [{ status: 200, corpo: "x".repeat(2_000_001) }, "grande_demais"],
  ];
  for (const [c, motivo] of casos) { const r = lerRespostaFonte(c); assert.ok(!r.ok && r.motivo === motivo, motivo); }
  const ok = lerRespostaFonte({ status: 200, contentType: "application/json", corpo: '{"a":1}' });
  assert.ok(ok.ok && ok.texto === '{"a":1}');
  assert.ok(lerRespostaFonte({ status: 200, contentType: "text/html", corpo: "<html>ok</html>" }, "html").ok);
});
test("aceite 8: cache vencido ou data inválida vira 'possivelmente desatualizado'", () => {
  assert.deepEqual(situacaoDoCache("2026-11-02T10:00:00Z", "2026-11-02T12:00:00Z", 24), { valido: true, desatualizado: false, idade_horas: 2 });
  const v = situacaoDoCache("2026-10-20T00:00:00Z", "2026-11-02T00:00:00Z", 24);
  assert.ok(!v.valido && v.desatualizado);
  assert.ok(situacaoDoCache("lixo", "2026-11-02T00:00:00Z", 24).desatualizado);
});
test("grafias do MESMO código (hífen, espaço, sem separador) valem; prefixo/sufixo de outro código não", async () => {
  for (const t of ["peça JC 1234 nova", "peça JC1234 nova", "peça jc-1234", "(JC-1234)"]) assert.equal(validarEvidencia(await ev({ trecho: t }), alvo, HOJE).nivel, "forte", t);
  for (const t of ["peça JC-12345", "peça XJC-1234", "peça JC-1234A"]) assert.equal(validarEvidencia(await ev({ trecho: t }), alvo, HOJE).nivel, "rejeitada", t);
});
