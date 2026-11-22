/**
 * Relatório unificado para o porteiro, SOMENTE LEITURA.
 *
 * A RPC validar_aplicacoes_do_sku usa referências de peças do grafo e
 * seus períodos técnicos; ela NÃO prova aplicação do CONJUNTO importado,
 * geração de fábrica, ano de fabricação nem composição da peça.
 *
 * A RPC verificar_cruzados_do_sku devolve códigos, NÃO outros SKUs
 * importados com estoque/documento fiscal. Nunca converter um código
 * cruzado em produto do Bling nem assumir inclusão de componente.
 */
import { projetarCruzamentosDoSku } from "./projecao_cruzados.ts";

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj | null => x && typeof x === "object" && !Array.isArray(x) ? x as Obj : null;
const txt = (x: unknown): string | null => typeof x === "string" && x.trim() ? x.trim() : null;
const ano = (x: unknown): number | null => typeof x === "number" && Number.isInteger(x)
  && x >= 1950 && x <= 2100 ? x : null;
const dadosArray = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
type RegistroCruzado = {
  codigo_referencia: string;
  classe_declarada: string;
  relacao_com_sku: string;
  status_ligacao: string;
  vinculo_representa_produto_inteiro: boolean;
  cruzamentos_diretos: unknown[];
};

/** Retém o contrato anterior de engenharia.cruzados.verificar e acrescenta campos consultivos. */
export function projetarDiagnosticoCronologicoDoSku(
  dadoCruzados: unknown,
  dadoAplicacoes: unknown,
  incluirAConfirmar = false,
) {
  const cruzados = projetarCruzamentosDoSku(dadoCruzados, incluirAConfirmar);
  if ("erro" in cruzados) return cruzados;

  const app = obj(dadoAplicacoes);
  const skuDado = txt(app?.sku);
  const fonteInvalida = !app || !Array.isArray(app.aplicacoes) ||
    (txt(app.erro) !== null) || skuDado !== cruzados.sku;
  const registros = fonteInvalida ? [] : dadosArray(app.aplicacoes)
    .map(obj).filter((r): r is Obj => r !== null)
    .filter(r => incluirAConfirmar || r.status === "aprovado")
    .map(r => {
      const periodoInicio = ano(r.periodo_inicio);
      const periodoFim = ano(r.periodo_fim);
      // Eventos podem ser históricos, mas não equivalem à data de início
      // ou fim DE FÁBRICA de todo o modelo. Eventos sem aprovação ficam ocultos.
      const eventos = dadosArray(r.eventos_no_brasil)
        .map(obj).filter((ev): ev is Obj => ev !== null)
        .filter(ev => incluirAConfirmar || ev.status === "aprovado")
        .map(ev => ({
          tipo: txt(ev.tipo), data_evento: txt(ev.data),
          precisao: txt(ev.precisao), status: txt(ev.status),
          interpretacao: "evento_documental_do_veiculo_nao_e_periodo_automático_do_sku",
        }));
      return {
        montadora: txt(r.montadora), modelo: txt(r.modelo),
        versao: txt(r.versao), mercado: txt(r.mercado),
        codigo_referencia: txt(r.peca),
        status_aplicacao_da_referencia: txt(r.status),
        periodo_referencia_inicio: periodoInicio,
        periodo_referencia_fim: periodoFim,
        tipo_periodo: "cobertura_da_referencia_no_grafo_nao_fabricacao_do_veiculo",
        // A RPC atual não expõe projeto, revisão, faixa VIN, código do
        // fabricante do conjunto, homologação do SKU nem fontes diretas.
        projeto_geracao: null,
        fase_revisao_fabrica: null,
        vin_faixa: null,
        documento_compatibilidade_do_sku: null,
        situacao_do_conjunto: "a_confirmar",
        eventos_historicos: eventos,
        restricoes: txt(r.restricoes),
        pendencias: [
          "geracao_ou_projeto_e_revisao_fabrica",
          "periodo_e_tipo_de_ano_documentados_no_brasil",
          "cotejo_fisico_do_conjunto_por_sku_e_versao",
          "fonte_direta_e_revisao_humana",
        ],
      };
    });

  // Sem identificador fiscal do outro item, um código cruzado não pode
  // ser apresentado como SKU importado equivalente ou produto à venda.
  const referenciasSemInclusao = (cruzados.pecas as RegistroCruzado[])
    .filter(p => !p.vinculo_representa_produto_inteiro)
    .map(p => ({
      codigo_referencia: p.codigo_referencia,
      relacao_com_sku: p.relacao_com_sku,
      status_ligacao: p.status_ligacao,
      interpretacao: "referencia_a_conferir_nao_e_componente_comprovadamente_incluido",
    }));

  return {
    ...cruzados,
    cronologia_veicular: {
      estado: fonteInvalida ? "consulta_indisponivel" : "referencias_tecnicas_sem_homologacao_do_conjunto",
      registros,
      total: registros.length,
      geracao_fabrica_comprovada_pela_rpc: false,
      aplicacao_do_conjunto_homologada_por_este_relatorio: false,
      diagnostico: fonteInvalida
        ? (txt(app?.erro) ?? "A RPC de aplicações não devolveu resultado íntegro para o mesmo SKU.")
        : "Os períodos pertencem às posições do catálogo técnico; não comprovam cronologia de fábrica, VIN ou compatibilidade de um motor importado completo.",
    },
    outros_skus_importados: {
      skus_equivalentes_confirmados: [],
      candidatos_identificados_nesta_consulta: [],
      estado: "sem_correspondencia_fiscal_direta_na_rpc",
      proxima_prova: "Verificar SKU/bling_id independente e comparar packing list, nível do conjunto, fabricante, interfaces e aplicações de cada geração.",
    },
    componentes_avulsos: {
      skus_avulsos_confirmados: [],
      referencias_de_escopo_nao_confirmado: referenciasSemInclusao,
      estado: "sem_composicao_fisica_e_sku_avulso_comprovados_nesta_rpc",
      proxima_prova: "Comparar composição física por posição com SKU/NF da peça avulsa, OEM do componente e fonte técnica específica.",
    },
    pode_publicar_equivalencias_com_este_relatorio: false,
    aviso_cronologia: "Sem transposição de geração, ano, OEM de componente ou SKU avulso para o motor parcial. Só vínculo direto comprovado e aprovado pelo lojista pode ir à loja.",
  };
}
