import { test } from "node:test";
import assert from "node:assert/strict";
import { projetarDiagnosticoCronologicoDoSku } from "./projecao_cronologia_sku.ts";

const cruzados = {
  sku: "CI003696",
  pecas: [
    { codigo:"MOTOR-CONJUNTO-REFERENCIA", classe:"aftermarket_equivalente",
      relacao_com_o_sku:"e_esta_peca", status_da_ligacao:"aprovado",
      cruzados_diretos:[{codigo:"COD-OUTRO-FABRICANTE",status:"aprovado",tipo:"referencia_cruzada"}] },
    { codigo:"OEM-CABECOTE-POSICAO", classe:"genuina",
      relacao_com_o_sku:"referencia_cruzada", status_da_ligacao:"a_confirmar",
      cruzados_diretos:[] },
  ],
};
const aplicacoes = {
  sku: "CI003696", resultado: "confirmada",
  aplicacoes: [
    {montadora:"Hyundai",modelo:"HR",versao:"2.5 D4CB",mercado:"BR",
      status:"aprovado",peca:"MOTOR-CONJUNTO-REFERENCIA",
      periodo_inicio:2014,periodo_fim:2021,
      eventos_no_brasil:[{tipo:"inicio_comercializacao",data:"2013-01-01",precisao:"ano",status:"aprovado"}]},
    {montadora:"Kia",modelo:"Bongo K2500",versao:"2.5 D4CB",mercado:"BR",
      status:"a_confirmar",peca:"OEM-CABECOTE-POSICAO",periodo_inicio:2014,periodo_fim:null},
  ],
};

test("consulta padrão só mostra referência técnica aprovada, sem inventar geração de fábrica", () => {
  const r:any = projetarDiagnosticoCronologicoDoSku(cruzados, aplicacoes);
  assert.equal(r.sku, "CI003696");
  assert.equal(r.cronologia_veicular.total, 1);
  assert.equal(r.cronologia_veicular.registros[0].montadora, "Hyundai");
  assert.equal(r.cronologia_veicular.registros[0].periodo_referencia_inicio, 2014);
  assert.equal(r.cronologia_veicular.registros[0].projeto_geracao, null);
  assert.equal(r.cronologia_veicular.registros[0].situacao_do_conjunto, "a_confirmar");
  assert.equal(r.pode_publicar_equivalencias_com_este_relatorio, false);
});

test("quando solicitado, mostra candidatas mas não transforma marca/ano em aplicação", () => {
  const r:any=projetarDiagnosticoCronologicoDoSku(cruzados,aplicacoes,true);
  assert.equal(r.cronologia_veicular.total,2);
  assert.equal(r.cronologia_veicular.registros[1].situacao_do_conjunto,"a_confirmar");
  assert.equal(r.pecas.length,2);
  assert.equal(r.componentes_avulsos.referencias_de_escopo_nao_confirmado.length,1);
  assert.equal(r.componentes_avulsos.skus_avulsos_confirmados.length,0);
});

test("um código cruzado nunca vira SKU de motor importado sem identidade fiscal",()=>{
  const r:any=projetarDiagnosticoCronologicoDoSku(cruzados,aplicacoes);
  assert.deepEqual(r.outros_skus_importados.skus_equivalentes_confirmados,[]);
  assert.deepEqual(r.outros_skus_importados.candidatos_identificados_nesta_consulta,[]);
  assert.equal(r.pecas[0].cruzamentos_diretos[0].codigo,"COD-OUTRO-FABRICANTE");
  assert.equal(r.pecas[0].cruzamentos_diretos[0].interpretacao,"referencia_pesquisa");
});

test("ano ausente ou sem fim permanece incógnito, nunca até hoje", () => {
  const r:any=projetarDiagnosticoCronologicoDoSku(cruzados,{
    sku:"CI003696",aplicacoes:[{
      montadora:"Hyundai",modelo:"HR",status:"aprovado",
      periodo_inicio:null,periodo_fim:null,peca:"P1",
    }]
  });
  const a=r.cronologia_veicular.registros[0];
  assert.equal(a.periodo_referencia_inicio,null);
  assert.equal(a.periodo_referencia_fim,null);
  assert.equal(a.tipo_periodo,"cobertura_da_referencia_no_grafo_nao_fabricacao_do_veiculo");
});

test("erro da RPC de aplicação não apaga cruzamento nem cria incompatibilidade", () => {
  const r:any=projetarDiagnosticoCronologicoDoSku(cruzados,{erro:"RPC indisponível"});
  assert.equal(r.pecas.length,1);
  assert.equal(r.cronologia_veicular.estado,"consulta_indisponivel");
  assert.equal(r.cronologia_veicular.total,0);
  assert.match(r.cronologia_veicular.diagnostico,/RPC indisponível/);
  assert.equal(r.pode_publicar_equivalencias_com_este_relatorio,false);
});

test("SKU diferente no relatório de gerações é recusado", () => {
  const r:any=projetarDiagnosticoCronologicoDoSku(cruzados,{...aplicacoes,sku:"OUTRO-SKU"});
  assert.equal(r.cronologia_veicular.estado,"consulta_indisponivel");
  assert.equal(r.cronologia_veicular.total,0);
});

test("grafo sem peça ou sem versão não inventa fabricante, OEM ou estoque",()=>{
  const r:any=projetarDiagnosticoCronologicoDoSku({sku:"CI003696",pecas:[]},
    {sku:"CI003696",resultado:"nao_confirmada",aplicacoes:[]});
  assert.deepEqual(r.pecas,[]);
  assert.deepEqual(r.outros_skus_importados.skus_equivalentes_confirmados,[]);
  assert.deepEqual(r.componentes_avulsos.skus_avulsos_confirmados,[]);
  assert.equal(r.cronologia_veicular.total,0);
});

test("erro da RPC principal continua erro, não diagnóstico vazio de SKU",()=>{
  const r:any=projetarDiagnosticoCronologicoDoSku({erro:"Produto não encontrado nesta loja."},aplicacoes);
  assert.deepEqual(r,{erro:"Produto não encontrado nesta loja."});
});

test("eventos do modelo não viram período nem confirmação de inclusão do importado",()=>{
  const r:any=projetarDiagnosticoCronologicoDoSku(cruzados,aplicacoes);
  const a=r.cronologia_veicular.registros[0];
  assert.equal(a.eventos_historicos.length,1);
  assert.notEqual(a.eventos_historicos[0].data_evento,String(a.periodo_referencia_inicio));
  assert.equal(a.documento_compatibilidade_do_sku,null);
});
