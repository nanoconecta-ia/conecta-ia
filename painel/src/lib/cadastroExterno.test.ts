import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gerarPromptCadastro, validarCadastroExterno } from "./cadastroExterno.ts";

const base = {
  formato:"conecta-cadastro-v1", sku:"CI003696", erp_origem:"Bling",
  operacao:"propor_enriquecimento",
  produto:{descricao:"Motor parcial",marca:"Trim Go",codigo_fabricante:null,gtin:null,
    especificacoes:[{campo:"tipo",valor:"parcial",fonte:"documento de produto"}]},
  referencias_oem:[],
  aplicacoes_veiculares:[],
  fontes:[{titulo:"Fabricante",url:"https://fabricante.example/catalogo"}],
  pendencias:["Confirmar aplicações"],
  publicar:false,status:"a_confirmar"
};

test("aceita pacote estrito de proposta sem persistir",()=>{
  const r=validarCadastroExterno(JSON.stringify(base));
  assert.equal(r.ok,true);
  if(!r.ok)return;
  assert.equal(r.pacote.sku,"CI003696");
  assert.equal(r.pacote.publicar,false);
  assert.equal(r.pacote.referencias_oem.length,0);
});
test("recusa preço, custo, estoque, credenciais ou escrita no ERP",()=>{
  for(const campo of ["preco","custo","estoque","ncm","service_role","loja_id"]) {
    const r=validarCadastroExterno(JSON.stringify({...base,[campo]:"não permitido"}));
    assert.equal(r.ok,false, campo);
  }
  assert.equal(validarCadastroExterno(JSON.stringify({...base,publicar:true})).ok,false);
  assert.equal(validarCadastroExterno(JSON.stringify({...base,operacao:"gravar_no_bling"})).ok,false);
  assert.equal(validarCadastroExterno('{"access_token":"sensivel","formato":"conecta-cadastro-v1"}').ok,false);
});
test("OEM e aplicação informados como verificados voltam a confirmar",()=>{
  const r=validarCadastroExterno(JSON.stringify({...base,
    referencias_oem:[{montadora:"Hyundai",codigo:"REF-TESTE",fonte:"catálogo",status:"verificado"}],
    aplicacoes_veiculares:[{montadora:"Hyundai",modelo:"HR",versao:null,motor:"D4CB",ano_inicial:2013,ano_final:2022,fonte:"catálogo",status:"homologado"}]
  }));
  assert.equal(r.ok,true);
  if(!r.ok)return;
  assert.equal(r.pacote.referencias_oem[0].status,"a_confirmar");
  assert.equal(r.pacote.aplicacoes_veiculares[0].status,"a_confirmar");
  assert.equal(r.alertas.length,2);
});
test("recusa anos invertidos e URLs que não sejam HTTPS",()=>{
  const a={montadora:"Hyundai",modelo:"HR",versao:null,motor:null,ano_inicial:2022,ano_final:2013,fonte:"teste",status:"a_confirmar"};
  assert.equal(validarCadastroExterno(JSON.stringify({...base,aplicacoes_veiculares:[a]})).ok,false);
  assert.equal(validarCadastroExterno(JSON.stringify({...base,fontes:[{titulo:"Insegura",url:"http://exemplo.com"}]})).ok,false);
});
test("tolerância a bloco markdown de JSON, mas não permite execução",()=>{
  const r=validarCadastroExterno("```json\n"+JSON.stringify(base)+"\n```");
  assert.equal(r.ok,true);
  const p=gerarPromptCadastro("CI003696");
  assert.match(p,/conecta-cadastro-v1/);
  assert.match(p,/Não invente código OEM/);
  assert.doesNotMatch(p,/sk-[a-z0-9]{20}/i);
});
test("UI inclui campo para colar, prévia e nenhuma ação de gravação",()=>{
  const component=readFileSync(new URL("../componentes/CadastroImportado.tsx",import.meta.url),"utf8");
  const page=readFileSync(new URL("../paginas/MeuAgente.tsx",import.meta.url),"utf8");
  assert.match(component,/Validar e visualizar/);
  assert.match(component,/Prévia da proposta — não gravada/);
  assert.doesNotMatch(component,/supabase\.|fonte\.chamar\(|fetch\(/);
  assert.match(page,/<CadastroImportado\s*\/>/);
});
