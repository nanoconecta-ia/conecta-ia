// Catálogo único de ferramentas (issue #166, PR B1). O Tool Registry (registro.ts) é a ÚNICA fonte de verdade sobre o que
// uma ferramenta é: risco, permissão, estado e exposição. As outras duas superfícies que já existem em produção mantêm seus
// nomes públicos (o LLM do assistente e os clientes do gateway Pair já os conhecem), mas cada nome aponta para um id do registro.
// O assistente consulta o Policy Engine com essa definição antes de executar; os testes garantem que nenhuma superfície
// exponha algo que o registro não conhece ou que esteja planejado/desligado.
import { buscarDefinicao } from "./registro.ts";
import { decidir } from "./policy.ts";
import type { DefinicaoFerramenta, ResultadoPolicy } from "./tipos.ts";

/** Nome usado pelo LLM na edge `assistente` (ia/ferramentas.ts) -> id no registro. */
export const ALIASES_ASSISTENTE: Readonly<Record<string, string>> = {
  resumo_loja: "conecta.catalogo.resumo",
  listar_produtos: "conecta.catalogo.listar",
  ver_produto: "conecta.catalogo.ver",
  itens_pendentes: "conecta.enriquecimento.pendentes",
  buscar_taxonomia: "engenharia.taxonomia.buscar",
  status_bling: "bling.status.consultar",
  listar_plugins: "conecta.plugins.listar",
  chamar_plugin: "conecta.plugins.chamar",
  propor_enriquecimento: "conecta.enriquecimento.propor",
  propor_codigo: "conecta.codigo.propor",
  propor_aplicacao: "conecta.aplicacao.propor",
  buscar_dados_tecnicos_web: "conecta.web.pesquisar_tecnico",
  buscar_imagem_web: "conecta.imagem.buscar_web",
  propor_imagem: "conecta.imagem.propor",
  bling_categorias: "bling.categorias.consultar",
  bling_propor_categoria: "bling.categorias.preparar_criacao",
  bling_propor_reativar_produto: "bling.produtos.preparar_reativacao",
  bling_propor_ajuste_produto: "bling.produtos.preparar_atualizacao",
  bling_propor_trocar_categoria: "bling.categorias.preparar_alteracao_lote",
};

/**
 * Nome público do gateway Pair (`conecta-gateway`, implantado) -> id no registro.
 * `null` = capacidade que, por enquanto, só existe no gateway Pair e ainda não tem contrato no registro
 * (nem handler no conector). Entra no registro na PR C2; os testes travam esta lista para nada novo entrar sem contrato.
 */
export const ALIASES_PAIR: Readonly<Record<string, string | null>> = {
  "conecta.bling_consultar_produto": "bling.produtos.consultar",
  "conecta.list_products": "conecta.catalogo.listar",
  "conecta.get_product": "conecta.catalogo.ver",
  "conecta.propose_enrichment": "conecta.enriquecimento.propor",
  "conecta.propose_code": "conecta.codigo.propor",
  "conecta.propose_application": "conecta.aplicacao.propor",
  "conecta.propose_image": "conecta.imagem.propor",
  "conecta.get_part_by_code": null,
  "conecta.propose_bula": null,
  "conecta.propose_banner": null,
  "conecta.get_pending_approvals": null,
  "conecta.get_task_status": null,
  // Nano Guardião, fase 3 (leitura dos valores já aprovados por SKU): contrato no registro na C2.
  "conecta.get_validated_fields": null,
};

export const definicaoDoAssistente = (nome: string): DefinicaoFerramenta | undefined => {
  const id = ALIASES_ASSISTENTE[nome];
  return id ? buscarDefinicao(id) : undefined;
};

/** Policy Engine para uma ferramenta do assistente (origem chat). Nome sem alias = desconhecida = negada. */
export const politicaDoAssistente = (nome: string): ResultadoPolicy => decidir(definicaoDoAssistente(nome), { origem: "chat" });
