import {test} from "node:test";
import assert from "node:assert/strict";
import {inventariarContratosMcp,inventariarExposicaoMcp} from "./patrimonio_mcp.ts";
import {decidir} from "../conector/policy.ts";
import {nomeParaLlm} from "../conector/registro.ts";
const ids=["bling.categorias.consultar","bling.categorias.criar","bling.categorias.preparar_alteracao_lote","bling.categorias.preparar_criacao","bling.estoque.consultar","bling.precos.consultar","bling.produtos.alterar","bling.produtos.alterar_preco","bling.produtos.confirmar","bling.produtos.consultar","bling.produtos.criar","bling.produtos.imagens_adicionar","bling.produtos.preparar_alteracao_preco","bling.produtos.preparar_atualizacao","bling.produtos.preparar_cadastro","bling.produtos.preparar_reativacao","bling.status.consultar","conecta.aplicacao.propor","conecta.banner.anexar","conecta.banners.gerenciar","conecta.catalogo.listar","conecta.catalogo.resumo","conecta.catalogo.ver","conecta.codigo.propor","conecta.contexto.produto_ativo","conecta.enriquecimento.definir","conecta.enriquecimento.pendentes","conecta.enriquecimento.propor","conecta.fabricante.pagina_preparar","conecta.imagem.buscar_web","conecta.imagem.propor","conecta.midia.anexar_produto","conecta.plugins.chamar","conecta.plugins.listar","conecta.proposta.criar","conecta.proposta.estado","conecta.publicacao.preparar","conecta.publicacao.publicar","conecta.seo.verificar","conecta.travas.consultar","conecta.web.pesquisar_tecnico","conhecimento.buscar","dev.codigo.preparar","dev.docs.consultar","dev.github.consultar","dev.pr.propor","dev.testes.executar","engenharia.aplicacoes.validar","engenharia.bula.verificar","engenharia.classificacao.propor","engenharia.compartilhamento.sugerir","engenharia.consulta.interpretar","engenharia.cruzados.verificar","engenharia.duplicidade.detectar","engenharia.fabricantes.identificar","engenharia.genealogia.organizar","engenharia.intercambio.listar","engenharia.loja.condicoes","engenharia.loja.filtros","engenharia.loja.pecas_do_veiculo","engenharia.oem.buscar","engenharia.oem.pesquisar","engenharia.pesquisa.investigar","engenharia.taxonomia.buscar","engenharia.taxonomia.construir","nano.atividade.registrar","nano.diagnostico.ia"];
const locais=["browser.elemento.clicar","browser.pagina.ler","windows.ambiente.versoes","windows.disco.livre","windows.processo.existe","windows.servico.estado","windows.servico.reiniciar","windows.sistema.inventario"];
const assistente={"resumo_loja":"conecta.catalogo.resumo","diagnostico_ia":"nano.diagnostico.ia","listar_produtos":"conecta.catalogo.listar","ver_produto":"conecta.catalogo.ver","itens_pendentes":"conecta.enriquecimento.pendentes","buscar_taxonomia":"engenharia.taxonomia.buscar","status_bling":"bling.status.consultar","listar_plugins":"conecta.plugins.listar","chamar_plugin":"conecta.plugins.chamar","propor_enriquecimento":"conecta.enriquecimento.propor","propor_codigo":"conecta.codigo.propor","propor_aplicacao":"conecta.aplicacao.propor","buscar_dados_tecnicos_web":"conecta.web.pesquisar_tecnico","buscar_imagem_web":"conecta.imagem.buscar_web","propor_imagem":"conecta.imagem.propor","bling_categorias":"bling.categorias.consultar","bling_propor_categoria":"bling.categorias.preparar_criacao","bling_propor_reativar_produto":"bling.produtos.preparar_reativacao","bling_propor_ajuste_produto":"bling.produtos.preparar_atualizacao","bling_propor_cadastro_produto":"bling.produtos.preparar_cadastro","bling_propor_alterar_preco":"bling.produtos.preparar_alteracao_preco","bling_propor_trocar_categoria":"bling.categorias.preparar_alteracao_lote"};
const pair={"conecta.bling_consultar_produto":"bling.produtos.consultar","conecta.list_products":"conecta.catalogo.listar","conecta.get_product":"conecta.catalogo.ver","conecta.propose_enrichment":"conecta.enriquecimento.propor","conecta.propose_code":"conecta.codigo.propor","conecta.propose_application":"conecta.aplicacao.propor","conecta.propose_image":"conecta.imagem.propor","conecta.get_part_by_code":null,"conecta.propose_bula":null,"conecta.propose_banner":null,"conecta.get_pending_approvals":null,"conecta.get_task_status":null,"conecta.set_active_product":null,"conecta.get_validated_fields":null,"conecta.get_sync_status":null,"conecta.get_product_images":null,"conecta.chat_reivindicar":null,"conecta.chat_responder":null};
test("MCP-98-01: identidades históricas do registro e capacidades locais preservadas",()=>{
 const r=inventariarContratosMcp();assert.deepEqual(r.registro.map(x=>x.id).sort(),ids);assert.deepEqual(r.locais.map(x=>x.id).sort(),locais);
 assert.equal(r.homologacaoOperacional,false);
});
test("MCP-98-02: aliases históricos inclusive lacunas Pair preservados",()=>{
 const r=inventariarContratosMcp();assert.deepEqual(r.aliasesAssistente,assistente);assert.deepEqual(r.aliasesPair,pair);assert.equal(r.pairSemContrato.length,11);
});
test("MCP-98-03: nenhuma exposição sem escopo e nenhum executor externo",()=>{
 assert.deepEqual(inventariarExposicaoMcp([],false),[]);assert.deepEqual(inventariarExposicaoMcp([],true),[]);
 const r=inventariarContratosMcp();
 for(const f of r.registro.filter(x=>x.permissao==="executar")){
  assert.equal(decidir(f,{origem:"gateway_mcp",escopos:["executar"],aprovacaoValida:true,escritaRealLiberada:true}).decisao,"negada");
  assert.equal(decidir(f,{origem:"chat",aprovacaoValida:true}).decisao,"negada");
 }
 assert.deepEqual(inventariarExposicaoMcp(["executar"],true),[]);
});
test("MCP-98-04: lista do gateway preserva schemas, escopo e estado",()=>{
 const r=inventariarContratosMcp();
 for(const escopo of ["leitura","propor","simular"] as const){
  const lista=inventariarExposicaoMcp([escopo],false);
  const esperadas=r.registro.filter(x=>x.estado==="ativa"&&x.exposicao.mcp&&x.permissao===escopo);
  assert.deepEqual(lista.map(x=>x.name).sort(),esperadas.map(x=>x.nomeMcp).sort());
  for(const f of esperadas){assert.deepEqual(lista.find(x=>x.name===f.nomeMcp)?.inputSchema,f.entrada);assert.equal(decidir(f,{origem:"gateway_mcp",escopos:[]}).decisao,"negada");}
 }
});
test("MCP-98-05: descoberta local depende de pareamento, Windows e leitura; escrita desligada",()=>{
 const sem=inventariarExposicaoMcp(["leitura"],false),com=inventariarExposicaoMcp(["leitura"],true);
 const extras=com.filter(x=>!sem.some(y=>y.name===x.name));
 assert.deepEqual(extras.map(x=>x.name).sort(),["windows.sistema.inventario","windows.ambiente.versoes","windows.disco.livre","windows.processo.existe","windows.servico.estado"].map(nomeParaLlm).sort());
 assert.ok(!inventariarExposicaoMcp(["leitura","propor"],true).some(x=>x.name.startsWith("browser__")||x.name==="windows__servico__reiniciar"));
});
