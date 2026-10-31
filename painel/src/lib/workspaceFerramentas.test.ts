import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buscarFerramentas, lerFavoritos } from "./workspaceFerramentas.ts";
const itens: [string,string][] = [["/","Visão geral"],["/catalogo","Catálogo"],["/assistente","Assistente"],["/bling","Bling"]];
test("somente rotas efetivamente permitidas podem ser recuperadas de favoritos locais",()=>{
  assert.deepEqual(lerFavoritos(JSON.stringify(["/bling","/admin-inexistente","/bling",3]),itens.map(x=>x[0])),["/bling"]);
  assert.deepEqual(lerFavoritos("nao-json",["/","/assistente"]),["/","/assistente"]);
});
test("a pesquisa aceita acentos e não cria ferramentas inexistentes",()=>{
  assert.deepEqual(buscarFerramentas(itens,"catalogo"),[["/catalogo","Catálogo"]]);
  assert.equal(buscarFerramentas(itens,"pagamento").length,0);
  assert.deepEqual(buscarFerramentas(itens,""),itens);
});
