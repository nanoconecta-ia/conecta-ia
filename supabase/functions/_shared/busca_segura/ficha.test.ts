// Teste de aceite 9 do PR #242: fallback sem IA mostra a ficha verificada sem expor custos nem dados sensíveis.
import { test } from "node:test";
import assert from "node:assert/strict";
import { higienizar, montarFichaVerificada } from "./ficha.ts";
import { hashTrecho, type EvidenciaBusca } from "./evidencia.ts";
import { gerarFichaSemLLM } from "../assistente/ficha_sem_llm.ts";

const evid = async (): Promise<EvidenciaBusca> => { const trecho = "Junta JC-1234 para HR"; return { url: "https://fabricante.exemplo.com.br/jc-1234", titulo: "Cat", coletada_em: "2026-11-01", trecho, codigo_exato: "JC-1234", contexto_aplicacao: "HR 2.5", sha256: await hashTrecho(trecho), confianca: 0.9, classe: "fabricante_oficial" }; };

test("aceite 9: a ficha NÃO traz custo, fornecedor, fiscal, credencial nem dado pessoal, em nenhum nível", async () => {
  const f = montarFichaVerificada({
    sku: "JC-1234", codigos: ["JC-1234"], hoje: "2026-11-02", evidencias: [await evid()],
    confirmados: { marca: "Sabó", preco: 99.9, precoCusto: 41.2, fornecedor: { nome: "Distribuidora X", cnpj: "12.345.678/0001-90" }, ncm: "8484.10.00" },
    propostos: { descricao_curta: "Junta do cabeçote. Contato: compras@distribuidora.com.br (11) 91234-5678", seo: { token: "sbp_abcdefghijklmnop1234", titulo: "Junta HR" } },
    divergencias: [{ campo: "espessura_mm", valores: ["1,2", "1,6"], fontes: ["catálogo A", "catálogo B"] }],
    pendencias: ["medidas a confirmar", "fornecedor CNPJ 12.345.678/0001-90 a revisar"],
  });
  const { removidos_por_seguranca: _nomes, ...sem } = f; // a lista de remoções traz só NOMES de chave (auditoria), nunca valores
  const tudo = JSON.stringify(sem) + f.texto;
  for (const proibido of ["precoCusto", "41.2", "Distribuidora X", "12.345.678/0001-90", "8484.10.00", "compras@distribuidora.com.br", "91234-5678", "sbp_abcdefghijklmnop1234"]) assert.ok(!tudo.includes(proibido), proibido);
  assert.ok(f.removidos_por_seguranca.some((r) => /precoCusto/.test(r)) && f.removidos_por_seguranca.some((r) => /fornecedor/.test(r)) && f.removidos_por_seguranca.some((r) => /ncm/.test(r)));
  assert.match(f.texto, /Sabó/); assert.match(f.texto, /espessura_mm: 1,2 x 1,6/); assert.match(f.texto, /NADA FOI GRAVADO NO BLING/);
  assert.equal(f.fontes[0].nivel, "forte");
});
test("a ficha lista confirmados, propostos, divergências, fontes e pendências, e marca 'nenhum' quando vazio", () => {
  const f = montarFichaVerificada({ sku: "X-1", codigos: [], hoje: "2026-11-02", evidencias: [], confirmados: {}, propostos: {}, divergencias: [], pendencias: [] });
  for (const t of ["CONFIRMADOS", "PROPOSTOS", "DIVERGÊNCIAS", "FONTES", "PENDÊNCIAS"]) assert.match(f.texto, new RegExp(t));
  assert.equal((f.texto.match(/- nenhum/g) ?? []).length, 5);
});
test("higienizar não altera dado público e não vaza o valor removido no relatório de remoções", () => {
  const r = new Set<string>(); const o = higienizar({ nome: "Junta HR", cnpj: "12.345.678/0001-90", n: { custo: 5, ok: 1 } }, r);
  assert.deepEqual(o, { nome: "Junta HR", n: { ok: 1 } }); assert.deepEqual([...r].sort(), ["cnpj", "n.custo"]);
});
test("fallback sem IA (ficha do Bling): mesmo que a evidência traga custo/fornecedor/fiscal, o texto final não os expõe", () => {
  const r = gerarFichaSemLLM({ termo: "JC-1234", total_candidatos: 1, candidatos: [{ id: "1", sku: "JC-1234", nome: "Junta HR", situacao: "ativo", origem: "api_bling", precoCusto: 41.2, fornecedor: "Distribuidora X", ncm: "8484.10.00", cnpj: "12.345.678/0001-90" }],
    fontes: [{ origem: "api_bling", consultada: true, completa: true }], conclusao: { api_completa: true, ausencia_nos_filtros_pesquisados: false, autoriza_criacao: false }, simulado: true, consultado_em: "2026-11-02" });
  for (const proibido of ["41.2", "Distribuidora X", "8484.10.00", "12.345.678/0001-90"]) assert.ok(!r.resposta.includes(proibido), proibido);
  assert.equal(r.autoriza_criacao, false); assert.match(r.resposta, /NENHUM PRODUTO FOI CADASTRADO/);
});
