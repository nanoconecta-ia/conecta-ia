import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretarConsulta, type Vocabulario } from "./interpretar.ts";

// Vocabulário FICTÍCIO de teste (o real vem do banco).
const voc: Vocabulario = {
  modelos: [
    { montadora: "MarcaA", modelo: "UtilX", categoria: "utilitario", versoes: ["UtilX 2.5 16V Euro 5"] },
    { montadora: "MarcaB", modelo: "UtilY", categoria: "utilitario", versoes: ["UtilY 2.5 4x2", "UtilY 2.5 4x4"], apelidos: ["util y"] },
    { montadora: "MarcaC", modelo: "UtilY", categoria: "van", versoes: ["UtilY van"] },
  ],
  pecas: [
    { slug: "motor-completo", nome: "Motor completo", sinonimos: ["motor parcial"] },
    { slug: "motor-de-arranque", nome: "Motor de arranque", sinonimos: ["motor de partida"] },
    { slug: "junta-cabecote", nome: "Junta do cabeçote", sinonimos: ["jogo de juntas"] },
    { slug: "pastilha", nome: "Pastilha de freio" },
  ],
};

test("pergunta aberta: reconhece modelo e ano, e pergunta QUAL peça quando 'motor' é ambíguo", () => {
  const r = interpretarConsulta("Qual é o motor para o caminhão UtilX 2011?", voc, 2026);
  assert.equal(r.veiculo.modelo, "UtilX");
  assert.equal(r.veiculo.ano, 2011);
  assert.equal(r.intencao, "descobrir_peca");
  assert.ok(r.pecas.length >= 2, "há mais de uma família com 'motor'");
  assert.ok(r.perguntas.some((p) => p.includes("Motor completo") && p.includes("Motor de arranque")), "lista as opções do cadastro");
  assert.ok(r.avisos.some((a) => a.includes("utilitario") && a.includes("caminhao")), "avisa a divergência de tipo em vez de corrigir calado");
});

test("termo igual em duas montadoras: pergunta a montadora; citando a montadora, resolve", () => {
  const r = interpretarConsulta("pastilha de freio utily 2015", voc, 2026);
  assert.equal(r.veiculo.modelo, undefined, "'utily' não existe no cadastro: nada é adivinhado");
  const dup = interpretarConsulta("pastilha de freio UtilY 2015", voc, 2026);
  assert.ok(dup.falta.includes("montadora"));
  const ok = interpretarConsulta("pastilha de freio MarcaB UtilY 2015", voc, 2026);
  assert.equal(ok.veiculo.montadora, "MarcaB");
  assert.ok(ok.falta.includes("versao_ou_motor"), "o modelo tem 2 versões cadastradas: pergunta qual");
  assert.ok(!ok.falta.includes("ano") && !ok.falta.includes("peca"));
});

test("sem veículo e sem peça: pergunta o essencial; ano implausível ou ambíguo não é aceito", () => {
  const vazio = interpretarConsulta("", voc);
  assert.deepEqual(vazio.falta, ["modelo", "peca"]);
  assert.equal(interpretarConsulta("junta UtilX 20112", voc, 2026).veiculo.ano, undefined);
  assert.equal(interpretarConsulta("junta UtilX 2030", voc, 2026).veiculo.ano, undefined, "ano futuro não existe");
  const dois = interpretarConsulta("junta UtilX 2011 2012", voc, 2026);
  assert.equal(dois.veiculo.ano, undefined);
  assert.ok(dois.avisos.some((a) => a.includes("Vários anos")));
});

test("termos fora do cadastro aparecem como não reconhecidos (nunca viram dado)", () => {
  const r = interpretarConsulta("junta do cabeçote UtilX 2011 turbo xyzzy", voc, 2026);
  assert.deepEqual(r.pecas.map((p) => p.slug), ["junta-cabecote"]);
  assert.ok(r.nao_reconhecido.includes("xyzzy"));
});

import { montarRespostaConsulta } from "./resposta.ts";
test("resposta: só fatos cadastrados; sem prazo/pagamento cadastrado vira lacuna e nada é prometido", () => {
  const i = interpretarConsulta("junta do cabeçote UtilX 2011", voc, 2026);
  const r = montarRespostaConsulta(i, [{ sku: "JG-1", nome: "Junta do cabeçote UtilX", preco: 120.5, estoque: 3, base: "motor" }],
    { nome: "Loja T", arrependimento_dias: 7, garantia_legal_dias: 90, entrega_texto: null, garantia_texto: null, troca_devolucao_texto: null });
  assert.match(r.mensagem, /Encontrei 1 produto/);
  assert.match(r.mensagem, /confirmada pelo motor/);
  assert.match(r.mensagem, /arrependimento em 7 dias/);
  assert.ok(!/entrega r[aá]pida|frete gr[aá]tis|pix|cart[aã]o/i.test(r.mensagem), "nada prometido que a loja não cadastrou");
  assert.ok(r.lacunas.some((l) => l.includes("entrega")) && r.lacunas.some((l) => l.includes("pagamento")));
  assert.ok(!/gemini|deepseek|openai|gpt/i.test(JSON.stringify(r)), "nome de provedor nunca aparece");
});
test("resposta: sem produto, diz NÃO CONFIRMADO (não 'incompatível') e mantém as perguntas", () => {
  const i = interpretarConsulta("motor UtilX 2011", voc, 2026);
  const r = montarRespostaConsulta(i, [], null);
  assert.equal(r.precisa_perguntar, true);
  assert.ok(r.perguntas.length > 0 && r.produtos.length === 0);
  const sem = montarRespostaConsulta(interpretarConsulta("junta do cabeçote UtilX 2011", voc, 2026), [], null);
  assert.match(sem.mensagem, /NÃO CONFIRMADO/);
});
