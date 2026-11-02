// Testes de aceite 6 e 7 do PR #242.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCandidata, LIMITE_GALERIA, montarGaleria, validarTratamento, type CandidataEntrada } from "./galeria.ts";
import { hashTrecho, type EvidenciaBusca } from "./evidencia.ts";

const HOJE = "2026-11-02";
const alvo = { codigos: ["JC-1234"] };
const evid = async (p: Partial<EvidenciaBusca> = {}): Promise<EvidenciaBusca> => {
  const trecho = "Junta do cabeçote JC-1234 Hyundai HR";
  return { url: "https://fabricante.exemplo.com.br/jc-1234", titulo: "Catálogo", coletada_em: "2026-11-01", trecho, codigo_exato: "JC-1234", contexto_aplicacao: "HR 2.5", sha256: await hashTrecho(trecho), confianca: 0.9, classe: "fabricante_oficial", ...p };
};
const cand = async (n: number, p: Partial<CandidataEntrada> = {}): Promise<CandidataEntrada> => ({
  url: `https://fabricante.exemplo.com.br/img/${n}.jpg`, pagina: "https://fabricante.exemplo.com.br/jc-1234", largura_px: 1200, altura_px: 900, angulo: "frontal",
  marca_dagua: false, licenca: "fabricante", direitos_confirmados_em: "2026-11-01", evidencia: await evid(), ...p });

test("aceite 6: imagem de peça SEMELHANTE é rejeitada", async () => {
  const i = avaliarCandidata(await cand(1, { e_peca_semelhante: true }), alvo, HOJE);
  assert.equal(i.estado, "rejeitada"); assert.ok(i.motivos.some((m) => /semelhante/.test(m)));
});
test("aceite 6: imagem com MARCA D'ÁGUA é inutilizável e o sistema não a remove", async () => {
  const i = avaliarCandidata(await cand(1, { marca_dagua: true }), alvo, HOJE);
  assert.equal(i.estado, "rejeitada"); assert.ok(i.motivos.some((m) => /não utilizável.*não remove/.test(m)));
  assert.ok(validarTratamento({ original_sha256: "a".repeat(64), operacoes: ["remover_marca_dagua"] }).bloqueios.some((b) => /proibida: remover_marca_dagua/.test(b)));
});
test("aceite 6: LICENÇA desconhecida é aprovável como identidade, mas NÃO publicável", async () => {
  const i = avaliarCandidata(await cand(1, { licenca: null, direitos_confirmados_em: null }), alvo, HOJE);
  assert.equal(i.estado, "aprovavel"); assert.equal(i.licenca, "desconhecida"); assert.equal(i.publicavel, false);
  assert.ok(i.motivos.some((m) => /NÃO publicável/.test(m)));
});
test("marca d'água não conferida, sem evidência, marketplace e resolução baixa/desconhecida ficam PENDENTES", async () => {
  assert.equal(avaliarCandidata(await cand(1, { marca_dagua: null }), alvo, HOJE).estado, "pendente");
  assert.equal(avaliarCandidata(await cand(1, { evidencia: null }), alvo, HOJE).estado, "pendente");
  const mk = await evid({ url: "https://produto.mercadolivre.com.br/x", classe: "marketplace" });
  assert.equal(avaliarCandidata(await cand(1, { evidencia: mk }), alvo, HOJE).estado, "pendente");
  assert.equal(avaliarCandidata(await cand(1, { largura_px: 120, altura_px: 100 }), alvo, HOJE).estado, "pendente");
  const sem = avaliarCandidata(await cand(1, { largura_px: null, altura_px: null }), alvo, HOJE);
  assert.equal(sem.estado, "pendente"); assert.equal(sem.resolucao, "desconhecida");
});
test("ângulo alternativo só sem rejeição se for o mesmo produto confirmado; vem rotulado", async () => {
  assert.equal(avaliarCandidata(await cand(1, { angulo: "lateral" }), alvo, HOJE).estado, "pendente");
  const ok = avaliarCandidata(await cand(1, { angulo: "lateral", mesmo_produto_confirmado: true }), alvo, HOJE);
  assert.equal(ok.estado, "aprovavel"); assert.equal(ok.angulo_alternativo, true);
});
test("aceite 7: OITO candidatas distintas viram galeria SEM aprovação automática e SEM nada publicável", async () => {
  const lista: CandidataEntrada[] = []; for (let n = 1; n <= 8; n++) lista.push(await cand(n));
  const g = montarGaleria(lista, alvo, HOJE);
  assert.equal(g.itens.length, 8); assert.equal(g.aprovacoes_automaticas, 0);
  assert.ok(g.itens.every((i) => i.aprovada === false && i.publicavel === false));
  assert.ok(g.itens.every((i) => i.codigo === "JC-1234" && i.origem === "fabricante.exemplo.com.br" && i.licenca === "fabricante" && i.evidencia));
});
test("aceite 7: mais de oito são cortadas em oito; duplicadas (mesma imagem) contam à parte; a melhor resolução vem primeiro", async () => {
  const lista: CandidataEntrada[] = []; for (let n = 1; n <= 12; n++) lista.push(await cand(n, { largura_px: 400 + n * 10, altura_px: 400 + n * 10 }));
  lista.push(await cand(3)); // duplicada de 3 (mesma URL)
  const g = montarGaleria(lista, alvo, HOJE);
  assert.equal(g.itens.length, LIMITE_GALERIA); assert.equal(g.omitidas, 4); assert.equal(g.duplicadas, 1);
  assert.equal(g.itens[0].resolucao, "520x520");
  const ex = montarGaleria(lista, alvo, HOJE, 99); assert.equal(ex.itens.length, 8, "o teto de 8 não é ultrapassável");
});
test("aceite 7: aprováveis vêm antes de pendentes e rejeitadas", async () => {
  const g = montarGaleria([await cand(1, { marca_dagua: true }), await cand(2, { evidencia: null }), await cand(3)], alvo, HOJE);
  assert.deepEqual(g.itens.map((i) => i.estado), ["aprovavel", "pendente", "rejeitada"]);
});
test("aceite 7: tratamento não destrutivo preserva o original; operações generativas ou que alteram a peça são recusadas", () => {
  const sha = "b".repeat(64);
  assert.ok(validarTratamento({ original_sha256: sha, operacoes: ["fundo_branco", "enquadramento", "expansao_canvas", "correcao_luz_conservadora"] }).ok);
  for (const op of ["super_resolucao_generativa", "inpainting", "recorte_da_peca", "espelhar", "gerar_peca", "apagar_inscricao"]) assert.ok(!validarTratamento({ original_sha256: sha, operacoes: [op] }).ok, op);
  assert.ok(!validarTratamento({ original_sha256: "", operacoes: ["fundo_branco"] }).ok, "sem SHA do original");
  assert.ok(!validarTratamento({ original_sha256: sha, operacoes: ["fundo_branco"], geometria_alterada: true }).ok);
  assert.ok(!validarTratamento({ original_sha256: sha, operacoes: ["fundo_branco"], inscricoes_alteradas: true }).ok);
  assert.ok(!validarTratamento({ original_sha256: sha, operacoes: ["nao_existe"] }).ok);
});
