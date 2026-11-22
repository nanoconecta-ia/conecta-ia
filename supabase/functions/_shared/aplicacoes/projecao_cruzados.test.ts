import { test } from "node:test";
import assert from "node:assert/strict";
import { projetarCruzamentosDoSku } from "./projecao_cruzados.ts";

const dados = {
  sku: "CI003696",
  pecas: [
    {
      codigo:"OEM-CONJUNTO-TESTE", classe:"aftermarket_equivalente",
      relacao_com_o_sku:"e_esta_peca", status_da_ligacao:"aprovado",
      cruzados_diretos:[
        {codigo:"CODIGO-OUTRO-FABRICANTE",classe:"aftermarket_equivalente",
          tipo:"referencia_cruzada",status:"aprovado",restricoes:"D4CB exemplo",evidencia:"catálogo teste"},
        {codigo:"CODIGO-PROPOSTO",classe:"oes",
          tipo:"equivalente_validado",status:"a_confirmar",evidencia:"a apurar"},
      ],
    },
    {
      codigo:"OEM-CABECOTE-TESTE",classe:"genuina",
      relacao_com_o_sku:"referencia_cruzada",status_da_ligacao:"a_confirmar",
      cruzados_diretos:[{codigo:"OUTRO-CABECOTE",tipo:"equivalente_validado",status:"aprovado",evidencia:"teste"}],
    },
  ],
};
test("por padrão oculta ligação e cruzamento pendentes",()=>{
  const r:any=projetarCruzamentosDoSku(dados);
  assert.equal(r.pecas.length,1);
  assert.equal(r.pecas[0].cruzamentos_diretos.length,1);
  assert.equal(r.resumo.modo,"apenas_vinculos_aprovados");
});
test("referência cruzada aprovada não é equivalência mecânica",()=>{
  const r:any=projetarCruzamentosDoSku(dados);
  assert.equal(r.pecas[0].cruzamentos_diretos[0].interpretacao,"referencia_pesquisa");
  assert.match(r.pecas[0].cruzamentos_diretos[0].aviso,/não prova substituição/);
});
test("consulta explícita exibe pendências mas não as promove",()=>{
  const r:any=projetarCruzamentosDoSku(dados,true);
  assert.equal(r.pecas.length,2);
  assert.equal(r.pecas[0].cruzamentos_diretos[1].interpretacao,"a_confirmar");
  assert.equal(r.pecas[1].vinculo_representa_produto_inteiro,false);
});
test("somente vínculo e_esta_peca aprovado representa o SKU inteiro",()=>{
  const r:any=projetarCruzamentosDoSku(dados,true);
  assert.equal(r.pecas[0].vinculo_representa_produto_inteiro,true);
  assert.equal(r.pecas[1].vinculo_representa_produto_inteiro,false);
});
test("mesmo tipo de relação aprovado informa classificação registrada, sem prometer homologação",()=>{
  const r:any=projetarCruzamentosDoSku({
    sku:"CI003696",pecas:[{
      codigo:"OEM-CONJUNTO",classe:"aftermarket_equivalente",
      relacao_com_o_sku:"e_esta_peca",status_da_ligacao:"aprovado",
      cruzados_diretos:[{codigo:"OUTRA-MARCA",tipo:"equivalente_validado",status:"aprovado",evidencia:"laudo"}]
    }]
  });
  assert.equal(r.pecas[0].cruzamentos_diretos[0].interpretacao,"relacao_aprovada_no_grafo");
  assert.match(r.pecas[0].cruzamentos_diretos[0].aviso,/confirmar o escopo físico/);
});
test("grafo A-B e B-C não gera A-C",()=>{
  const r:any=projetarCruzamentosDoSku({
    sku:"CI003696",pecas:[{codigo:"A",relacao_com_o_sku:"e_esta_peca",status_da_ligacao:"aprovado",
      cruzados_diretos:[{codigo:"B",tipo:"referencia_cruzada",status:"aprovado"}]}]
  });
  assert.equal(r.resumo.cruzamentos_diretos,1);
  assert.deepEqual(r.pecas[0].cruzamentos_diretos.map((x:any)=>x.codigo),["B"]);
});
test("resposta sem vínculo não inventa OEM nem SKU de fabricante",()=>{
  const r:any=projetarCruzamentosDoSku({sku:"CI003696",pecas:[]});
  assert.deepEqual(r.pecas,[]);
  assert.equal(r.resumo.referencias_visiveis,0);
});
test("erro do banco não é convertido em cadastro vazio silencioso",()=>{
  assert.deepEqual(projetarCruzamentosDoSku({erro:"Produto não encontrado nesta loja."}),
    {erro:"Produto não encontrado nesta loja."});
});
test("resposta incompleta é recusada",()=>{
  assert.ok("erro" in projetarCruzamentosDoSku({sku:"CI003696"}));
});
