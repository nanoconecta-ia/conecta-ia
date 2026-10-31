import { test } from "node:test";
import { strict as assert } from "node:assert";
import { orientarPagina } from "./navegacaoContextual.ts";
const menu:[string,string][]=[["/catalogo","Catálogo"],["/taxonomia","Taxonomia"],["/pesquisa","Pesquisa Web"],["/fila","Fila"]];
test("mostra somente ações para rotas realmente habilitadas",()=>{
 const v=orientarPagina("/taxonomia",menu);
 assert.match(v.descricao,/fonte/);
 assert.deepEqual(v.acoes.map(x=>x.rota),["/pesquisa","/fila"]);
});
test("área desconhecida não inventa capacidades",()=>{
 const x=orientarPagina("/desconhecida",[["/","Início"]]);
 assert.equal(x.acoes.length,0);
 assert.match(x.descricao,/sessão/);
});
test("ações não possuem permissão de escrita implícita",()=>{
 for (const rota of ["/taxonomia","/pesquisa","/catalogo","/bling"]){
  for (const a of orientarPagina(rota,menu).acoes) assert.ok(a.rota.startsWith("/") && !/aprovad[oa] automaticamente|executa escrita/i.test(a.descricao));
 }
});
