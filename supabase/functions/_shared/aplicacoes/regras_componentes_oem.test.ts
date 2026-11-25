import { test } from "node:test";
import assert from "node:assert/strict";
import { validarVinculoOemComponente, validarVinculoProdutoAvulso, type VinculoComponente, type ProdutoAvulsoCandidato } from "./regras_componentes_oem.ts";

const produto = { loja_id: "mobis", bling_id: "16719530075", sku: "CI003696", marca_peca: "TRIM GO", automacao_pausada: false };
const hoje = "2026-11-21";
const base: VinculoComponente = {
  loja_id: "mobis", bling_id: "16719530075", sku: "CI003696",
  finalidade: "oem_componente_veiculo", componente: "bronzina de mancal", codigo_oem: "EXEMPLO-NAO-REAL-001",
  montadora: "Hyundai", modelo: "HR", versao: "D4CB 2.5 16V Euro 5", motor: "D4CB", mercado: "BR",
  evidencias: [{tipo:"epc",url:"https://partsouq.com/en/catalog/genuine/unit?exemplo=true",consultada_em:"2026-11-20",
    codigo_conferido:"EXEMPLO-NAO-REAL-001",posicao_diagrama:"pos-11",nivel_diagrama:"componente",versao_identificada:"HR D4CB 2.5 16V Euro 5"}],
};
const avaliar=(p:VinculoComponente,acao:"propor"|"aprovar"|"publicar"="aprovar",ator:"agente"|"usuario"="usuario") =>
  validarVinculoOemComponente(p,produto,{acao,ator,hoje});
const bloqueado=(p:VinculoComponente,codigo:string,acao:"propor"|"aprovar"|"publicar"="aprovar") => {
  const r=avaliar(p,acao);
  assert.equal(r.ok,false);
  assert.ok(r.bloqueios.some(b=>b.codigo===codigo),JSON.stringify(r.bloqueios));
};

test("EPC de componente documentado pode ser revisado sem homologar produto importado",()=>{
  const r=avaliar(base);
  assert.equal(r.ok,true);
  assert.equal(r.situacao,"confirmavel");
});
test("registro de candidato tem status a_confirmar, nao aprovado",()=>{
  const r=avaliar(base,"propor","agente");
  assert.equal(r.ok,true);
  assert.equal(r.situacao,"a_confirmar");
});
test("EPC nao comprova que componente vem dentro do SKU TRIM GO",()=>{
  bloqueado({...base,finalidade:"incluido_no_sku"},"inclusao_nao_documentada");
});
test("prova de composicao precisa apontar SKU exato e fonte adequada",()=>{
  const p={...base,finalidade:"incluido_no_sku" as const,evidencias:[
    {...base.evidencias[0],tipo:"packing_list" as const,sku_documentado:"OUTRO-SKU"},
  ]};
  bloqueado(p,"inclusao_nao_documentada");
  assert.equal(avaliar({...p,evidencias:[{...p.evidencias[0],sku_documentado:"CI003696"}]}).ok,true);
});
test("OEM de bronzina nao vira OEM do motor parcial",()=>{
  const fontes=[...base.evidencias,{tipo:"packing_list" as const,url:"https://fabricante.example/lista",
    sku_documentado:"CI003696",consultada_em:"2026-11-20"}];
  bloqueado({...base,finalidade:"oem_conjunto",evidencias:fontes,
    evidencia_oem_aprovada:true,componente_fisico_conferido:true,medida_conferida:true
  },"oem_do_componente_nao_e_oem_do_conjunto");
});
test("OEM do conjunto exige fonte com nivel conjunto, inclusao e confronto fisico",()=>{
  const p:VinculoComponente={...base,componente:"motor parcial completo",finalidade:"oem_conjunto",
    evidencia_oem_aprovada:true,componente_fisico_conferido:true,medida_conferida:true,
    evidencias:[{...base.evidencias[0],nivel_diagrama:"conjunto"},
      {tipo:"packing_list",url:"https://fabricante.example/lista",consultada_em:"2026-11-20",sku_documentado:"CI003696"}]};
  assert.equal(avaliar(p).ok,true);
  bloqueado({...p,componente_fisico_conferido:false},"equivalencia_fisica_nao_comprovada");
});
test("OEM veicular nao pode ser aprovado sem localizador do diagrama nem versao",()=>{
  const p={...base,evidencias:[{...base.evidencias[0],posicao_diagrama:""}]};
  bloqueado(p,"epc_insuficiente");
});
test("mistura montadora/versao nao entra sem contexto completo",()=>{
  const p={...base,versao:""};
  bloqueado(p,"versao_sem_contexto");
});
test("agente nunca aprova ou publica",()=>{
  const r=avaliar(base,"aprovar","agente");
  assert.ok(r.bloqueios.some(b=>b.codigo==="agente_nao_aprova"));
});
test("SKU pausado bloqueia ate mesmo proposta",()=>{
  const r=validarVinculoOemComponente(base,{...produto,automacao_pausada:true},{acao:"propor",ator:"agente",hoje});
  assert.ok(r.bloqueios.some(b=>b.codigo==="produto_pausado"));
});
test("SKU/bl_id divergente nao aceita equivalencia de outra peca",()=>{
  bloqueado({...base,bling_id:"16719458152"},"identidade_fisica_divergente");
});
test("OEM com fonte futura ou sem URL/documento nao entra",()=>{
  bloqueado({...base,evidencias:[{...base.evidencias[0],consultada_em:"2099-01-01"}]},"fonte_nao_rastreavel");
});
test("publicacao de codigo OEM por veiculo exige aplicacao aprovada",()=>{
  bloqueado({...base,aplicacao_aprovada:false},"aplicacao_pendente","publicar");
});


const pecaAvulsa: ProdutoAvulsoCandidato = {
  loja_id: "mobis", bling_id_conjunto: "16719530075", sku_conjunto: "CI003696",
  componente: "comando de valvulas", origem: "RPM",
  bling_id_avulso: "ID-AVULSO-DE-TESTE", sku_avulso: "SKU-AVULSO-FICTICIO",
  nf_conjunto_ref_interna: "NF-CONJUNTO-TESTE", nf_avulsa_ref_interna: "NF-AVULSA-TESTE",
  mesmo_fornecedor: true, finalidade: "relacionado_para_pesquisa",
  fonte_identidade: "Documento catalogo RPM teste",
};

test("avulso em RPM e NF diferente: candidato sem mesclar SKU ou estoque", () => {
  const r = validarVinculoProdutoAvulso(pecaAvulsa, produto,
    {ator: "agente", acao: "propor", hoje});
  assert.equal(r.ok, true);
  assert.equal(r.situacao, "a_confirmar");
  assert.notEqual(pecaAvulsa.sku_avulso, produto.sku);
  assert.notEqual(pecaAvulsa.nf_avulsa_ref_interna, pecaAvulsa.nf_conjunto_ref_interna);
});

test("mesmo fornecedor e notas fiscais distintas NAO provam equivalencia fisica", () => {
  const r = validarVinculoProdutoAvulso({
    ...pecaAvulsa, finalidade: "equivalente_ao_componente_montado"
  }, produto, {ator: "usuario", acao: "aprovar", hoje});
  assert.ok(r.bloqueios.some(b => b.codigo === "equivalencia_sem_prova"));
});

test("referencia RPM sem SKU/ID pode ser pesquisada, mas nao homologada sem identificacao", () => {
  const p = {...pecaAvulsa, sku_avulso: undefined, bling_id_avulso: undefined, referencia_externa: undefined};
  const proposta = validarVinculoProdutoAvulso(p, produto, {ator:"agente",acao:"propor",hoje});
  assert.equal(proposta.situacao, "a_confirmar");
  const aprovacao = validarVinculoProdutoAvulso(p, produto, {ator:"usuario",acao:"aprovar",hoje});
  assert.ok(aprovacao.bloqueios.some(b=>b.codigo==="produto_avulso_nao_identificado"));
});

test("avulso nao pode ser a mesma identidade do conjunto", () => {
  const r = validarVinculoProdutoAvulso({...pecaAvulsa, bling_id_avulso:produto.bling_id},
    produto, {ator:"agente",acao:"propor",hoje});
  assert.ok(r.bloqueios.some(b=>b.codigo==="produto_nao_e_avulso"));
});

test("prova de equivalencia precisa de documento de composicao e confronto tecnico", () => {
  const p: ProdutoAvulsoCandidato = {
    ...pecaAvulsa, finalidade: "equivalente_ao_componente_montado",
    fonte_evidencia_conjunto: "Packing list SKU CI003696",
    evidencia_comparacao_fisica: "Laudo por codigo fabricante e versao",
    versao_motor_conferida: true, codigo_fabricante_conferido: true,
    interfaces_conferidas: true,
  };
  const r = validarVinculoProdutoAvulso(p, produto,{ator:"usuario",acao:"aprovar",hoje});
  assert.equal(r.ok,true);
  assert.equal(r.situacao,"confirmavel"); // requer revisao humana externa
});

test("pausa bloqueia qualquer proposta de vinculo avulso no produto", () => {
  const r = validarVinculoProdutoAvulso(pecaAvulsa, {...produto,automacao_pausada:true},
    {ator:"agente",acao:"propor",hoje});
  assert.ok(r.bloqueios.some(b=>b.codigo==="produto_pausado"));
});
