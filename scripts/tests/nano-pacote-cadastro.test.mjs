import { test } from "node:test";
import assert from "node:assert/strict";
import { verificarGtin, validarPacoteCadastro } from "../../supabase/functions/_shared/pacote_cadastro/contrato.ts";

const origem = () => ({
  versao: 1, bling_id: "16275882008", sku: null,
  idempotency_key: "mobis-oc1224-proposta-v1",
  origem_agente: { agente: "GPT via MCP", modelo: "teste" },
  identidade: { marca: null, codigo_fabricante: "OC1224", gtin: "7894766669907" },
  evidencias: [{
    id: "cat-mahle", classe: "fabricante_oficial",
    url: "https://www.mahle-aftermarket.com/catalogo", documento: null,
    trecho: "Catálogo de filtros MAHLE OC1224 HR 2.5 8V TDI",
    codigo_exato: "OC1224", consultado_em: "2026-11-16", reivindicacoes: ["hr"]
  }],
  aplicacoes: [{
    id: "hr", montadora: "Hyundai", modelo: "HR",
    modelo_id: null, geracao: "a confirmar", motor: "2.5 8V",
    ano_inicial: 2006, ano_final: 2012, codigo_oem: null,
    nao_se_aplica: ["Motores diferentes não homologados"],
    evidencia_ids: ["cat-mahle"], estado: "a_confirmar"
  }],
  imagens: [], taxonomia: {no_id: null,estado:"ausente"},
  texto: { titulo: null, descricao_pdv: null, descricao_tecnica: null, alt_imagem: null },
  logistica: { peso_kg: null, dimensoes_cm: null, estimado: false, base: null, margem_percentual: null }
});

test("estrutura aceita pacote incompleto, sem inventar homologação",()=>{
  const x=validarPacoteCadastro(origem());
  assert.equal(x.valido_estruturalmente,true);
  assert.equal(x.pronto_para_revisao,true);
  assert.equal(x.publicavel,false);
  assert.equal(x.altera_bling,false);
  assert.ok(x.pendencias.some(p=>p.includes("triangulação")));
  assert.ok(x.pendencias.some(p=>p.includes("GTIN"))===false);
});

test("GTIN deve ter dígito verificador correto e formato adequado",()=>{
  assert.equal(verificarGtin("7894766669907"),true);
  assert.equal(verificarGtin("7894766669900"),false);
  assert.equal(verificarGtin("7894"),false);
  const pacote=origem();
  pacote.identidade.gtin="7894766669900";
  assert.equal(validarPacoteCadastro(pacote).valido_estruturalmente,false);
});

test("bloqueia campo fiscal, comercial ou estoque no envelope",()=>{
  for(const campo of ["tributacao","ncm","fornecedor","estoque","preco","nota_fiscal"]){
    const pacote={...origem(),[campo]:"valor-injetado"};
    assert.ok(validarPacoteCadastro(pacote).erros.some(x=>x.includes(campo)));
  }
});

test("bloqueia aprovação de imagem emitida pelo agente",()=>{
  const pacote={...origem(),imagens:[{url:"https://cdn.exemplo.com/oc1224.png",aprovada:true}]};
  assert.equal(validarPacoteCadastro(pacote).valido_estruturalmente,false);
});

test("recusa URLs locais e evidência sem trecho literal do código",()=>{
  const p=origem();
  p.evidencias[0].url="https://localhost/tentativa";
  p.evidencias[0].trecho="Peça parecida sem referência exata";
  const r=validarPacoteCadastro(p);
  assert.ok(r.erros.some(x=>x.includes("insegura")));
  assert.ok(r.erros.some(x=>x.includes("Trecho literal")));
});

test("idempotency_key ausente é falha, e ano invertido também",()=>{
  const p=origem();
  p.idempotency_key="";
  p.aplicacoes[0].ano_inicial=2026;
  p.aplicacoes[0].ano_final=2006;
  const r=validarPacoteCadastro(p);
  assert.ok(r.erros.some(x=>x.includes("idempotência")));
  assert.ok(r.erros.some(x=>x.includes("invertido")));
});

test("aceitação estrutural não homologa fonte que afirma ser oficial",()=>{
  const p=origem();
  p.evidencias[0].url="https://marketplace.exemplo.com/oferta";
  p.evidencias[0].classe="fabricante_oficial";
  const r=validarPacoteCadastro(p);
  assert.equal(r.publicavel,false);
  assert.equal(r.pronto_para_revisao,true);
  assert.ok(r.pendencias.length>0);
});
