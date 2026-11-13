import { test } from "node:test";
import assert from "node:assert/strict";
import { UFS_BR, validarEntrada, avaliarFiscal } from "../../supabase/functions/_shared/loja/triagem_fiscal.ts";

const entrada = () => ({
  slug:"mobis",sku:"CI003696",uf_destino:"MG",
  tipo_destinatario:"cnpj",contribuinte_icms:"nao",finalidade:"uso_consumo",
});
const regra=()=>({
  uf_destino:"MG",tipo_destinatario:"cnpj",contribuinte_icms:"nao",finalidade:"uso_consumo",
  decisao:"liberar_atendimento",status:"validada",fundamento_normativo:"Norma hipotética SINTÉTICA",
  fonte_oficial:"https://exemplo.invalid/norma",validado_por_contador:"Contador SINTÉTICO",
  validado_em:"2026-11-01T10:00:00Z",inicio_vigencia:"2026-01-01",fim_vigencia:"2026-12-31",
});
const contexto = () => ({
  fase:"producao",lojaFiscal:{uf:"GO",regime:"presumido",validado_em:"2026-11-01T10:00:00Z"},
  produtoFiscal:{status:"validado",ncm:"84099190",validado_em:"2026-11-01T10:00:00Z"},
  regra:regra(),hoje:"2026-11-13",
});
test("27 estados, sem documentos pessoais e validação da entrada",()=>{
  assert.equal(UFS_BR.length,27);
  assert.deepEqual(validarEntrada(entrada()),entrada());
  assert.equal(validarEntrada({...entrada(),uf_destino:"ZZ"}),null);
  assert.equal(validarEntrada({...entrada(),tipo_destinatario:"rg"}),null);
  assert.equal(validarEntrada({...entrada(),finalidade:"nao_identificada"}),null);
  assert.equal(validarEntrada({...entrada(),sku:""}),null);
});
test("Loja TESTE nunca autoriza sequer triagem favorável",()=>{
  const c={...contexto(),fase:"teste"};
  const r=avaliarFiscal(entrada(),c);
  assert.equal(r.situacao,"analise_fiscal");
  assert.equal(r.pode_concluir_pedido,false);
});
test("Sem configuração fiscal da loja, sempre exige contador",()=>{
  const c={...contexto(),lojaFiscal:null};
  assert.equal(avaliarFiscal(entrada(),c).situacao,"analise_fiscal");
});
test("Sem classificação fiscal do produto, bloqueia decisão automática",()=>{
  const c={...contexto(),produtoFiscal:null};
  assert.equal(avaliarFiscal(entrada(),c).situacao,"analise_fiscal");
});
test("Sem regra da combinação exata, exige revisão",()=>{
  const c={...contexto(),regra:null};
  assert.equal(avaliarFiscal(entrada(),c).situacao,"analise_fiscal");
});
test("Regra apenas rascunhada nunca libera",()=>{
  const c={...contexto(),regra:{...regra(),status:"rascunho"}};
  assert.equal(avaliarFiscal(entrada(),c).situacao,"analise_fiscal");
});
test("Regra vencida ou UF diferente retorna pendente",()=>{
  const c={...contexto(),regra:{...regra(),fim_vigencia:"2026-10-01"}};
  assert.equal(avaliarFiscal(entrada(),c).situacao,"analise_fiscal");
  const d={...contexto(),regra:{...regra(),uf_destino:"GO"}};
  assert.equal(avaliarFiscal(entrada(),d).situacao,"analise_fiscal");
});
test("CNPJ não presume contribuinte ICMS",()=>{
  assert.equal(avaliarFiscal({...entrada(),contribuinte_icms:"nao_sei"},contexto()).situacao,"analise_fiscal");
});
test("Somente linha validada e exata permite pré-consulta, nunca pedido, ERP ou pagamento",()=>{
  const result=avaliarFiscal(entrada(),contexto());
  assert.equal(result.situacao,"apto_consulta");
  assert.equal(result.pode_concluir_pedido,false);
  assert.equal(result.encaminhar_erp,false);
});
test("Negação fiscal explícita bloqueia a modalidade",()=>{
  const c={...contexto(),regra:{...regra(),decisao:"bloquear"}};
  assert.equal(avaliarFiscal(entrada(),c).situacao,"restrito");
});
