// Protocolo deterministico de evidencias de componentes OEM (Porteiro / Conecta.IA).
// NAO grava dados. O EPC prova o numero OEM do componente de um VEICULO,
// nao que o componente esta incluido em um conjunto de reposicao de outra marca.
// Exige evidencias independentes para (a) codigo original, (b) conteudo do kit,
// (c) equivalencia fisica e (d) referencia do conjunto completo.
export type FinalidadeVinculo = "oem_componente_veiculo" | "incluido_no_sku" | "equivalente_ao_oem" | "oem_conjunto";
export type Papel = "agente" | "usuario";
export type Acao = "propor" | "aprovar" | "publicar";
export type TipoDocumento = "epc" | "catalogo_montadora" | "catalogo_fabricante" | "doc_importador" | "packing_list" | "foto_peca" | "anuncio_marketplace";
export interface EvidenciaComponente {
  tipo: TipoDocumento;
  url?: string | null;
  documento?: string | null;
  consultada_em: string;
  codigo_conferido?: string | null;
  posicao_diagrama?: string | null;
  nivel_diagrama?: "componente" | "subconjunto" | "conjunto" | null;
  sku_documentado?: string | null;
  versao_identificada?: string | null;
}
export interface IdentidadeFisica {
  loja_id: string; bling_id: string; sku: string; automacao_pausada: boolean;
  marca_peca: string;
}
export interface VinculoComponente {
  loja_id: string; bling_id: string; sku: string;
  finalidade: FinalidadeVinculo;
  componente: string;
  codigo_oem?: string | null;
  montadora?: string | null; modelo?: string | null;
  versao?: string | null; motor?: string | null; mercado?: string | null;
  medida_conferida?: boolean;
  componente_fisico_conferido?: boolean;
  evidencia_oem_aprovada?: boolean;
  aplicacao_aprovada?: boolean;
  evidencias: EvidenciaComponente[];
}
export interface Contexto { ator: Papel; acao: Acao; hoje: string }
export interface Bloqueio { codigo: string; mensagem: string }
export interface Resultado { ok: boolean; bloqueios: Bloqueio[]; situacao: "bloqueado" | "a_confirmar" | "confirmavel" }

/** Trata grafias de codigos para verificacao, mas preserva o original na ficha. */
const codigo = (v: string | null | undefined) => (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const campo = (v: string | null | undefined) => !!v && v.trim().length > 0;
const dataValida = (v: string, hoje: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(Date.parse(v + "T00:00:00Z"))
  && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v
  && v <= hoje;
const localizador = (e: EvidenciaComponente) => !!(e.url && /^https:\/\/\S+$/i.test(e.url))
  || campo(e.documento);
const forteOem = (e: EvidenciaComponente) => e.tipo === "epc" || e.tipo === "catalogo_montadora" || e.tipo === "catalogo_fabricante";
const fonteInclusao = (e: EvidenciaComponente, sku: string) =>
  ["packing_list", "doc_importador", "catalogo_fabricante"].includes(e.tipo)
  && codigo(e.sku_documentado) === codigo(sku);

/** Nunca permite transformar codigo de uma peça isolada em OEM do motor parcial sem prova do conjunto. */
export function validarVinculoOemComponente(
  proposta: VinculoComponente, produto: IdentidadeFisica, ctx: Contexto,
): Resultado {
  const bloqueios: Bloqueio[] = [];
  const barrar = (codigo: string, mensagem: string) => bloqueios.push({ codigo, mensagem });
  if (!campo(produto.bling_id) || proposta.bling_id !== produto.bling_id
    || proposta.loja_id !== produto.loja_id || proposta.sku !== produto.sku) {
    barrar("identidade_fisica_divergente", "SKU, loja e ID Bling devem identificar o mesmo produto fisico.");
  }
  if (produto.automacao_pausada) barrar("produto_pausado", "Nenhuma proposta ou escrita durante a pausa da automacao.");
  if (ctx.ator === "agente" && ctx.acao !== "propor") barrar("agente_nao_aprova", "Somente aprovador humano pode aprovar ou publicar.");
  if (!campo(proposta.componente)) barrar("componente_ausente", "Identifique o componente fisico individual.");
  if (proposta.finalidade !== "incluido_no_sku" && !codigo(proposta.codigo_oem)) {
    barrar("codigo_oem_ausente", "Codigo OEM pesquisado precisa ser informado.");
  }
  if (!proposta.evidencias?.length) barrar("sem_evidencia", "Informe fonte e data consultada.");

  const evidencias = (proposta.evidencias ?? []).filter((e) => localizador(e) && dataValida(e.consultada_em, ctx.hoje));
  if ((proposta.evidencias ?? []).length && evidencias.length === 0) {
    barrar("fonte_nao_rastreavel", "Nenhuma fonte tem localizador e data de consulta valida.");
  }
  if (ctx.acao !== "propor") {
    if (proposta.finalidade === "oem_componente_veiculo" || proposta.finalidade === "equivalente_ao_oem" || proposta.finalidade === "oem_conjunto") {
      if (![proposta.montadora, proposta.modelo, proposta.versao, proposta.motor, proposta.mercado].every(campo)) {
        barrar("versao_sem_contexto", "OEM exige montadora, modelo, versao, motor e mercado.");
      }
      if (!evidencias.some((e) => forteOem(e)
        && codigo(e.codigo_conferido) === codigo(proposta.codigo_oem)
        && campo(e.posicao_diagrama) && campo(e.versao_identificada))) {
        barrar("epc_insuficiente", "Exigir EPC ou catalogo com codigo, posicao do diagrama e versao conferidos.");
      }
    }
    if (proposta.finalidade === "incluido_no_sku" || proposta.finalidade === "equivalente_ao_oem" || proposta.finalidade === "oem_conjunto") {
      if (!evidencias.some((e) => fonteInclusao(e, proposta.sku))) {
        barrar("inclusao_nao_documentada", "EPC do veiculo nao prova que o importador incluiu a peça no SKU.");
      }
    }
    if (proposta.finalidade === "oem_conjunto") {
      if (!evidencias.some((e) => forteOem(e) && e.nivel_diagrama === "conjunto"
        && codigo(e.codigo_conferido) === codigo(proposta.codigo_oem))) {
        barrar("oem_do_componente_nao_e_oem_do_conjunto", "Referencia OEM do componente nao substitui codigo OEM do conjunto completo.");
      }
    }
    if (proposta.finalidade === "equivalente_ao_oem" || proposta.finalidade === "oem_conjunto") {
      if (!proposta.evidencia_oem_aprovada || !proposta.componente_fisico_conferido || !proposta.medida_conferida) {
        barrar("equivalencia_fisica_nao_comprovada", "Confirmar referencia OEM e identidade/medidas do componente do SKU.");
      }
    }
    if (ctx.acao === "publicar" && !proposta.aplicacao_aprovada) {
      barrar("aplicacao_pendente", "Publicacao de OEM por veiculo exige aplicacao homologada.");
    }
  }

  return { ok: bloqueios.length === 0, bloqueios, situacao: bloqueios.length ? "bloqueado" : ctx.acao === "propor" ? "a_confirmar" : "confirmavel" };
}
