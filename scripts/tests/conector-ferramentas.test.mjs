import { test } from "node:test";
import assert from "node:assert/strict";
import {validarAcaoCatalogo} from "../../supabase/functions/_shared/conector/catalogo_ferramentas.ts";

test("a consulta ao ERP é leitura e nunca recebe campo para escrever",()=>{
  const r=validarAcaoCatalogo({acao:"consultar_bling",sku:"CI003696",campo:"preco",valor:"999"});
  assert.equal(r.ok,true);
  if(r.ok){assert.equal(r.dados.ferramenta,"bling.produtos.consultar");assert.deepEqual(r.dados.entrada,{sku:"CI003696"});}
});
test("enriquecimento guarda só proposta com fonte e SKU exato",()=>{
  const r=validarAcaoCatalogo({acao:"propor_conecta",sku:"80692",campo:"descricao_longa",valor:"Retentor técnico teste",fonte:"Catálogo original fabricante 2026"});
  assert.equal(r.ok,true);
  if(r.ok){assert.equal(r.dados.ferramenta,"conecta.enriquecimento.propor");assert.equal(r.dados.entrada.campo,"descricao_longa");}
});
test("preparação da escrita não chama bling.produtos.alterar",()=>{
  const r=validarAcaoCatalogo({acao:"preparar_erp",sku:"CI003696",campo:"descricao_curta",valor:"Descrição técnica revisada",fonte:"https://fabricante.example/catalogo"});
  assert.equal(r.ok,true);
  if(r.ok){assert.equal(r.dados.ferramenta,"bling.produtos.preparar_atualizacao");
    const cam=r.dados.entrada.campos;assert.deepEqual(cam,{descricao_curta:"Descrição técnica revisada"});
    assert.equal((r.dados.entrada.fontes as any[])[0].url,"https://fabricante.example/catalogo");
  }
});
test("nenhuma ação de escrita direta é exposta ao painel",()=>{
  for(const acao of ["bling.produtos.alterar","gravar_erp","delete","criar_contato","publicar","executar"]){
    const r=validarAcaoCatalogo({acao,sku:"CI003696",campo:"descricao_curta",valor:"Teste produto",fonte:"Manual fabricante"});
    assert.equal(r.ok,false,acao);
  }
});
test("campos fiscais, preço, SKU, estoque, GTIN e categoria não passam",()=>{
  const blacklist=["preco","ncm","cfop","cest","codigo","gtin","estoque","familia_id","categoria_bling_id","tributacao","fornecedor"];
  for(const campo of blacklist){
    for(const acao of ["propor_conecta","preparar_erp"]){
      const r=validarAcaoCatalogo({acao,sku:"CI003696",campo,valor:"Produto teste",fonte:"Catálogo original"});
      assert.equal(r.ok,false,acao+"/"+campo);
    }
  }
});
test("sem fonte ou valor útil não cria proposta",()=>{
  for(const p of [
    {acao:"preparar_erp",sku:"CI003696",campo:"descricao_curta",valor:"Teste",fonte:""},
    {acao:"propor_conecta",sku:"CI003696",campo:"descricao_longa",valor:"",fonte:"Manual fabricante"},
    {acao:"propor_conecta",sku:"CI003696",campo:"tags",valor:"Caminhão",fonte:"x"},
    {acao:"preparar_erp",sku:"",campo:"descricao_curta",valor:"Produto",fonte:"Manual fabricante"},
  ])assert.equal(validarAcaoCatalogo(p).ok,false);
});
test("proteção básica de dados sensíveis e caracteres não autorizados",()=>{
  for(const valor of ["cpf: 12345678900","senha: exemplo","chave pix: exemplo","dados bancários: exemplo"]){
    assert.equal(validarAcaoCatalogo({acao:"propor_conecta",sku:"CI003696",campo:"descricao_longa",valor,fonte:"Manual fabricante"}).ok,false);
  }
  assert.equal(validarAcaoCatalogo({acao:"consultar_bling",sku:"CI003696\nfoo"}).ok,false);
});
