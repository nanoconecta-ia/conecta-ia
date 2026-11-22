import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCruzamento, arestasDiretas, type Cruzamento } from "./regras_cruzamento_multimarcas.ts";

// Todos os códigos e fontes do teste são FICTÍCIOS, não exemplos homologados.
const base: Cruzamento = {
  original: {
    montadora:"Hyundai",codigo:"OEM-EXEMPLO-CONJUNTO",
    fonte_epc:"EPC sintético",mercado:"BR",modelo:"HR",codigo_motor:"D4CB",
    ano_modelo:2014,posicao_diagrama:"conjunto-exemplo",escopo:"conjunto"
  },
  produto: {
    loja_id:"mobis",produto_id:"produto-fisico-teste",bling_id:"16719530075",sku:"CI003696",
    marca_comercial:"TRIM GO",fabricante:"FABRICANTE-FICTICIO",
    codigo_fabricante:"REF-FICTICIA-IMPORTADOR",pais_origem:"CN",escopo:"conjunto"
  },
  classe_declarada:"aftermarket_equivalente",
  relacao:"referencia_cruzada",status:"a_confirmar",aplicacao_homologada:false,
  evidencias: {fonte_oem:"fonte EPC fictícia",fonte_codigo_fabricante:"nota de fornecedor fictícia",data_consulta:"2026-11-21"}
};
const possui = (c:Cruzamento, codigo:string) => assert.ok(avaliarCruzamento(c).bloqueios.includes(codigo),
  JSON.stringify(avaliarCruzamento(c)));

test("SKU importado conserva identidade comercial e um OEM apenas como cruzamento candidato",()=>{
  const r=avaliarCruzamento(base);
  assert.equal(r.situacao,"a_confirmar");
  assert.equal(r.codigo_busca_oem,"OEMEXEMPLOCONJUNTO");
  assert.equal(base.produto.sku,"CI003696");
});
test("somente a origem China não torna a peça original ou homologada",()=>{
  const c={...base,classe_declarada:"oem_primeiro_equipamento" as const,evidencias:{...base.evidencias}};
  possui(c,"fabricante_original_nao_homologado_para_esta_peca");
});
test("fornecedor OES exige fornecimento por peça com fonte de homologação",()=>{
  possui({...base,classe_declarada:"oes"},"fabricante_original_nao_homologado_para_esta_peca");
  const r=avaliarCruzamento({...base,classe_declarada:"oes",
    evidencias:{...base.evidencias,fonte_fornecimento_original:"contrato fictício por componente e período"}});
  assert.equal(r.situacao,"a_confirmar");
});
test("peça genuína exige autenticidade documental distinta da referência OEM",()=>{
  possui({...base,classe_declarada:"genuina"},"peca_genuina_sem_autenticidade_documentada");
});
test("código OEM de bronzina não pode cruzar com o SKU do motor parcial inteiro",()=>{
  possui({...base,original:{...base.original,escopo:"componente"}},"oem_componente_nao_equivale_a_conjunto");
});
test("equivalente_validado exige prova direta do SKU e da variante, não só código igual",()=>{
  possui({...base,relacao:"equivalente_validado"},"equivalencia_direta_sem_comprovacao");
  const r=avaliarCruzamento({...base,relacao:"equivalente_validado",
    evidencias:{...base.evidencias,fonte_composicao_sku:"declaração fabricante fictícia por SKU",
      evidencia_compatibilidade_direta:"comparação técnica fictícia"}});
  assert.equal(r.situacao,"a_confirmar");
});
test("substituição exige evidência de revisão engenharia",()=>{
  possui({...base,relacao:"substituicao_engenharia",
    evidencias:{...base.evidencias,fonte_composicao_sku:"lista fictícia por SKU",
      evidencia_compatibilidade_direta:"comparação técnica fictícia"}},"substituicao_sem_revisao");
});
test("não homologa aplicações apenas porque código é comum à montadora",()=>{
  possui({...base,status:"aprovado",evidencias:{...base.evidencias,revisor_humano:"revisor-teste"}},
    "aplicacao_nao_homologada");
});
test("não autoaprova sem revisor humano",()=>{
  possui({...base,status:"aprovado",aplicacao_homologada:true},"aprovacao_sem_revisor");
});
test("OEM com posição mas sem contexto do mercado fica bloqueado",()=>{
  possui({...base,original:{...base.original,mercado:""}},"origem_oem_sem_contexto_rastreavel");
});
test("mesmo fornecedor não cria ligação transitiva entre outras marcas",()=>{
  const links=[{origem:"OEM-A",destino:"SKU-B"},{origem:"SKU-B",destino:"SKU-C"}];
  assert.deepEqual(arestasDiretas("OEM-A",links),[{origem:"OEM-A",destino:"SKU-B"}]);
});
test("outro SKU importado é outra identidade física, mesmo cruzamento OEM",()=>{
  const a=avaliarCruzamento(base);
  const b=avaliarCruzamento({...base,produto:{...base.produto,sku:"CI-OUTRO-EXEMPLO",bling_id:"BLING-OUTRO",produto_id:"outro-fisico"}});
  assert.equal(a.codigo_busca_oem,b.codigo_busca_oem);
  assert.notEqual(base.produto.sku,"CI-OUTRO-EXEMPLO");
  assert.equal(b.situacao,"a_confirmar");
});
