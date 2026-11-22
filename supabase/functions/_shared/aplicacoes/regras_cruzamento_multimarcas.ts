/**
 * Contrato de grafos de códigos comerciais e OEM para o porteiro.
 * Regra: código original da montadora != código de fabricante != SKU importado/ERP.
 * Uma referência é uma aresta DIRETA, não uma equivalência automática, recíproca
 * ou transitiva. Não cria registros, estoques, aplicações nem autorização de venda.
 *
 * Proposta para revisão (não conectada a RPC ou banco).
 */
export type ClasseReferencia = "genuina" | "oem_primeiro_equipamento" | "oes" | "aftermarket_equivalente";
export type GrauRelacao = "referencia_cruzada" | "equivalente_validado" | "substituicao_engenharia" | "substituto_homologado";
export type Escopo = "componente" | "conjunto";
export interface CodigoMontadora {
  montadora: string;
  codigo: string;
  fonte_epc: string;
  mercado: string;
  modelo: string;
  codigo_motor: string;
  norma_euro?: string | null;
  ano_modelo?: number | null;
  posicao_diagrama: string;
  escopo: Escopo;
}
export interface ProdutoIndependente {
  loja_id: string;
  produto_id: string;        // id fisico unico no Conecta
  bling_id: string;          // item fisico do Bling
  sku: string;               // codigo interno, NAO um OEM inferido
  marca_comercial: string;
  fabricante: string | null; // nao inferir de pais de importacao nem da montadora
  codigo_fabricante: string | null;
  pais_origem: string | null;
  escopo: Escopo;            // motor parcial inteiro != uma bronzina
}
export interface EvidenciasCruzamento {
  fonte_oem?: string | null;
  fonte_codigo_fabricante?: string | null;
  fonte_composicao_sku?: string | null;
  evidencia_compatibilidade_direta?: string | null; // cotejo do conjunto/versao, nao propaganda
  fonte_fornecimento_original?: string | null;      // para OEM/OES, por peca e periodo
  revisao_engenharia?: string | null;                // para substituicao
  data_consulta?: string | null;
  revisor_humano?: string | null;
}
export interface Cruzamento {
  original: CodigoMontadora;
  produto: ProdutoIndependente;
  classe_declarada: ClasseReferencia;
  relacao: GrauRelacao;
  status: "a_confirmar" | "aprovado";
  aplicacao_homologada: boolean;
  evidencias: EvidenciasCruzamento;
}
export interface ResultadoCruzamento {
  situacao: "a_confirmar" | "bloqueado" | "revisavel";
  bloqueios: string[];
  // Nunca altera produto, sku fiscal, NCM, GTIN, estoque ou OEM de outros itens.
  codigo_busca_oem: string | null;
}
const preenchido = (x: string | null | undefined) => typeof x === "string" && x.trim().length > 0;
const normalizado = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g,"");
const dataValida = (s: string | null | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s + "T00:00:00Z").toISOString().slice(0,10) === s;

/**
 * Aprova somente plausibilidade do cruzamento para revisao; NAO executa aprovacao.
 * Cada aresta precisa apontar diretamente ao codigo original e ao SKU desta peca.
 */
export function avaliarCruzamento(c: Cruzamento): ResultadoCruzamento {
  const b: string[] = [];
  const o = c.original, p = c.produto, e = c.evidencias;
  if (![o.montadora,o.codigo,o.mercado,o.modelo,o.codigo_motor,o.posicao_diagrama,o.fonte_epc].every(preenchido)
    || !dataValida(e.data_consulta)) b.push("origem_oem_sem_contexto_rastreavel");
  if (![p.loja_id,p.produto_id,p.bling_id,p.sku,p.marca_comercial].every(preenchido)) b.push("sku_independente_nao_identificado");
  if (o.escopo !== p.escopo) b.push("oem_componente_nao_equivale_a_conjunto");
  if (!preenchido(e.fonte_oem)) b.push("fonte_original_nao_rastreada");
  if (!preenchido(p.codigo_fabricante) || !preenchido(e.fonte_codigo_fabricante)) {
    b.push("codigo_comercial_sem_documento");
  }
  if (c.classe_declarada === "oem_primeiro_equipamento" || c.classe_declarada === "oes") {
    if (!preenchido(p.fabricante) || !preenchido(e.fonte_fornecimento_original)) {
      b.push("fabricante_original_nao_homologado_para_esta_peca");
    }
  }
  if (c.relacao !== "referencia_cruzada" && (!preenchido(e.evidencia_compatibilidade_direta)
    || !preenchido(e.fonte_composicao_sku))) {
    b.push("equivalencia_direta_sem_comprovacao");
  }
  if ((c.relacao === "substituicao_engenharia" || c.relacao === "substituto_homologado")
    && !preenchido(e.revisao_engenharia)) b.push("substituicao_sem_revisao");
  if (c.status === "aprovado" && !preenchido(e.revisor_humano)) b.push("aprovacao_sem_revisor");
  if (c.status === "aprovado" && !c.aplicacao_homologada) b.push("aplicacao_nao_homologada");
  return { situacao: b.length ? "bloqueado" : c.status === "a_confirmar" ? "a_confirmar" : "revisavel",
    bloqueios: b, codigo_busca_oem: preenchido(o.codigo) ? normalizado(o.codigo) : null };
}

/** Não cria fecho transitivo nem acha "todos os similares" por caminho A→B→C. */
export function arestasDiretas<T extends { origem: string; destino: string }>(origem: string, arestas: readonly T[]): T[] {
  return arestas.filter(a => a.origem === origem);
}
