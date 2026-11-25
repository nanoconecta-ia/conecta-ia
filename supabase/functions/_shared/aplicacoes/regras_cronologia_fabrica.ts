/**
 * Contrato PURO, conservador, da cronologia de aplicações e cruzamento de SKUs.
 * Não acessa ERP, banco, EPC, rede, fotos nem concede homologação.
 * A interface externa do agente/gateway ainda precisa implementar/persistir os gates.
 */
export type NivelConjunto = "motor_parcial_com_cabecote" | "motor_curto_sem_cabecote" |
  "motor_completo" | "cabecote_avulso" | "componente_avulso" | "outro";
export type TipoAno = "ano_modelo" | "fabricacao" | "comercializacao_brasil" | "cobertura_catalogo";
export interface GeracaoDocumentada {
  montadora: string;
  modelo: string;
  mercado: string;
  projeto_geracao: string | null;
  fase: string | null;
  codigo_motor: string | null;
  ano_inicio: number | null;
  ano_fim: number | null;
  tipo_ano: TipoAno;
  fonte_versao: string | null;
  /** Não tratar VIN ausente como compatibilidade ilimitada. */
  vin_ou_serie?: string | null;
}
export interface PropostaAplicacaoCronologica {
  sku: string;
  conjunto: NivelConjunto;
  versao: GeracaoDocumentada;
  fonte_compatibilidade_sku: string | null;
  status: "a_confirmar" | "aprovado";
}
export interface ProdutoCruzar {
  loja_id: string;
  sku: string;
  bling_id: string | null;
  nivel: NivelConjunto;
  fonte_identidade_fisica: string | null;
}
export interface PropostaVinculoCronologico {
  origem: ProdutoCruzar;
  destino: ProdutoCruzar;
  tipo: "equivalencia_conjunto" | "componente_avulso" | "sucessao_codigo";
  /** Prova independente de ambos os SKUs. */
  evidencia_direta: string | null;
  composicao_conferida: boolean;
  interfaces_conferidas: boolean;
  /** Vinculado à configuração, não ao simples nome do motor ou modelo. */
  versoes_comparadas: readonly PropostaAplicacaoCronologica[];
  /** Boletim que cita direção da supersessão e período de validade. */
  boletim_sucessao?: string | null;
}
export type ResultadoPortao = {
  estado: "a_confirmar" | "bloqueado" | "revisavel";
  bloqueios: string[];
  pendencias: string[];
};

const preenchido = (s: string | null | undefined) => !!s?.trim();
const anoValido = (n: number | null) => n == null || (Number.isInteger(n) && n >= 1950 && n <= 2100);
const ehAvulso = (n: NivelConjunto) => n === "cabecote_avulso" || n === "componente_avulso";
const isConjunto = (n: NivelConjunto) => [
  "motor_parcial_com_cabecote", "motor_curto_sem_cabecote", "motor_completo",
].includes(n);

/** Cada configuração independente precisa de origem documental própria.
 * Revisável não significa aprovação automática nem compatibilidade publicável.
 */
export function avaliarAplicacaoCronologica(p: PropostaAplicacaoCronologica): ResultadoPortao {
  const bloqueios: string[] = [], pendencias: string[] = [];
  const v = p.versao;
  if (!preenchido(p.sku)) bloqueios.push("sku_fisico_ausente");
  if (!preenchido(v.montadora) || !preenchido(v.modelo) || !preenchido(v.mercado))
    bloqueios.push("identidade_veiculo_ausente");
  if (!anoValido(v.ano_inicio) || !anoValido(v.ano_fim)
      || (v.ano_inicio != null && v.ano_fim != null && v.ano_inicio > v.ano_fim))
    bloqueios.push("periodo_invalido");
  if (!preenchido(v.projeto_geracao)) pendencias.push("geracao_fabrica_nao_comprovada");
  if (!preenchido(v.codigo_motor)) pendencias.push("codigo_motor_nao_comprovado");
  if (v.ano_inicio == null) pendencias.push("inicio_nao_comprovado");
  if (v.ano_fim == null) pendencias.push("fim_nao_comprovado");
  if (v.tipo_ano === "cobertura_catalogo") pendencias.push("cobertura_reposicao_nao_e_periodo_de_fabrica");
  if (!preenchido(v.fonte_versao)) pendencias.push("fonte_da_geracao_ausente");
  if (!preenchido(p.fonte_compatibilidade_sku)) pendencias.push("prova_aplicacao_desse_sku_ausente");
  if (p.status === "aprovado" && pendencias.length)
    bloqueios.push("aplicacao_aprovada_sem_provas_cronologicas");
  return { estado: bloqueios.length ? "bloqueado" : pendencias.length ? "a_confirmar" : "revisavel",
    bloqueios, pendencias };
}

/** As arestas são sempre DIRETAS e exigem cotejo próprio de escopo e versão.
 * Componente vendido isolado é RELAÇÃO DE COMPOSIÇÃO, nunca equivalência do conjunto.
 */
export function avaliarVinculoCronologico(p: PropostaVinculoCronologico): ResultadoPortao {
  const bloqueios: string[] = [], pendencias: string[] = [];
  if (!preenchido(p.origem.sku) || !preenchido(p.destino.sku)
      || p.origem.sku === p.destino.sku) bloqueios.push("skus_invalidos_ou_iguais");
  if (!preenchido(p.origem.loja_id) || p.origem.loja_id !== p.destino.loja_id)
    bloqueios.push("lojas_diferentes");
  if (preenchido(p.origem.bling_id) && p.origem.bling_id === p.destino.bling_id)
    bloqueios.push("mesmo_produto_erp_nao_e_sku_independente");
  if (!preenchido(p.origem.bling_id) || !preenchido(p.destino.bling_id))
    pendencias.push("identidade_erp_independente_nao_documentada");
  if (!preenchido(p.origem.fonte_identidade_fisica) || !preenchido(p.destino.fonte_identidade_fisica))
    pendencias.push("prova_de_ambos_os_produtos_ausente");
  if (p.tipo === "equivalencia_conjunto") {
    if (!isConjunto(p.origem.nivel) || p.origem.nivel !== p.destino.nivel)
      bloqueios.push("nivel_do_conjunto_diferente");
    if (!p.composicao_conferida) pendencias.push("composicao_nao_conferida");
    if (!p.interfaces_conferidas) pendencias.push("interfaces_nao_conferidas");
    if (!p.versoes_comparadas.length) pendencias.push("geracoes_nao_confrontadas");
    for (const v of p.versoes_comparadas) {
      const r = avaliarAplicacaoCronologica(v);
      if (r.estado !== "revisavel") pendencias.push("aplicacao_da_geracao_nao_comprovada");
    }
  } else if (p.tipo === "componente_avulso") {
    if (!isConjunto(p.origem.nivel) || !ehAvulso(p.destino.nivel))
      bloqueios.push("composicao_exige_conjunto_e_avulso");
    if (!p.composicao_conferida) pendencias.push("inclusao_fisica_do_avulso_nao_documentada");
    // Mesmo com todas as provas, a relação NÃO prova equivalência do conjunto;
    // o status revisável é apenas para o VÍNCULO avulso e nunca para substituir o motor.
  } else {
    if (!preenchido(p.boletim_sucessao)) pendencias.push("boletim_sucessao_com_vigencia_ausente");
    if (!p.versoes_comparadas.length) pendencias.push("periodo_de_sucessao_nao_confrontado");
    for (const v of p.versoes_comparadas) {
      if (avaliarAplicacaoCronologica(v).estado !== "revisavel")
        pendencias.push("periodo_de_sucessao_nao_comprovado_por_versao");
    }
  }
  if (!preenchido(p.evidencia_direta)) pendencias.push("evidencia_direta_ausente");
  return { estado: bloqueios.length ? "bloqueado" : pendencias.length ? "a_confirmar" : "revisavel",
    bloqueios, pendencias: [...new Set(pendencias)] };
}
