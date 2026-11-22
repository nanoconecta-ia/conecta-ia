// Resolucao de identidade da PESSA AVULSA para indice tecnico do porteiro.
// Nao gera SKUs fiscais, nao cria estoque ou produto Bling, nao vincula inclusao
// fisica ao conjunto e NAO publica OEM como homologado automaticamente.
export type EstadoOem = "candidato" | "verificado_no_epc" | "rejeitado";
export interface ReferenciaOemPesquisa {
  codigo: string;
  estado: EstadoOem;
  fonte_url: string;
  descricao_fonte: string;
  motor: string | null;
  modelo: string | null;
  mercado: string | null;
  ano_modelo: number | null;
  diagrama: string | null;
  posicao_diagrama: string | null;
  // Uma referencia do EPC pode ser validada para uma variante, mas isso NAO
  // prova que se encontra dentro do produto do importador.
  versao_confirmada: boolean;
}
export interface IdentificadorAvulso {
  sku_bl: string | null;
  sku_bl_confirmado: boolean;
  sku_nf: string | null;
  sku_nf_confirmado: boolean;
  codigo_fabricante: string | null;
  oems: ReferenciaOemPesquisa[];
}
export interface IdentidadeDeBusca {
  chave_indice: string | null;
  tipo: "sku_bling" | "sku_nota_fiscal" | "oem_referencia_tecnica" | "pendente";
  sku_fiscal: string | null;
  // Candidatos continuam visiveis na revisao, nao sao vendidos nem indexados
  // como equivalentes por aplicacao veicular.
  oems_candidatos: string[];
  necessita_revisao: boolean;
  motivo: string;
}
const normaliza = (s: string | null | undefined) => (s ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const oemValido = (x: ReferenciaOemPesquisa) => x.estado === "verificado_no_epc"
  && /^https:\/\/\S+$/i.test(x.fonte_url)
  && !!x.descricao_fonte.trim()
  && !!x.modelo?.trim() && !!x.motor?.trim()
  && !!x.mercado?.trim() && typeof x.ano_modelo === "number" && Number.isInteger(x.ano_modelo) && x.ano_modelo >= 1900 && x.ano_modelo <= 2100
  && !!x.diagrama?.trim() && !!x.posicao_diagrama?.trim()
  && x.versao_confirmada;

/** SKU fiscal real tem precedencia. Na falta dele, gera SOMENTE alias de busca OEM. */
export function resolverIdentidadeDeComponente(p: IdentificadorAvulso): IdentidadeDeBusca {
  const candidatos = [...new Set(p.oems.filter(x => x.estado !== "rejeitado")
    .map(x => normaliza(x.codigo)).filter(Boolean))].sort();
  const skuBl = normaliza(p.sku_bl);
  if (skuBl && p.sku_bl_confirmado) return {
    chave_indice: "SKU:" + skuBl, tipo: "sku_bling", sku_fiscal: p.sku_bl,
    oems_candidatos: candidatos, necessita_revisao: candidatos.length > 0,
    motivo: "SKU cadastrado no ERP; OEMs ficam como referencias distintas.",
  };
  const skuNf = normaliza(p.sku_nf);
  if (skuNf && p.sku_nf_confirmado) return {
    chave_indice: "SKU_NF:" + skuNf, tipo: "sku_nota_fiscal", sku_fiscal: p.sku_nf,
    oems_candidatos: candidatos, necessita_revisao: true,
    motivo: "Codigo da NF confirmado, sem criar produto nem estoque no Bling.",
  };
  // O OEM de uma peca com variante tecnica comprovada pode servir apenas como
  // alias de busca tecnico. Quando varios oems/espessuras/versoes sao validos,
  // exige escolher pela variante, nunca pega arbitrariamente o primeiro.
  const validos = [...new Set(p.oems.filter(oemValido).map(x => normaliza(x.codigo)).filter(Boolean))];
  if (validos.length === 1) return {
    chave_indice: "OEM:" + validos[0], tipo: "oem_referencia_tecnica", sku_fiscal: null,
    oems_candidatos: candidatos, necessita_revisao: true,
    motivo: "OEM identificado em EPC de uma versao; NAO e SKU fiscal nem equivalencia com o item do conjunto.",
  };
  return {
    chave_indice: null, tipo: "pendente", sku_fiscal: null,
    oems_candidatos: candidatos, necessita_revisao: true,
    motivo: validos.length > 1
      ? "Multiplos OEMs de variantes: resolver por chassi, ano, mercado e diagrama."
      : "Sem SKU real nem OEM inequivoco de variante comprovada; pesquisar sem inventar codigo.",
  };
}
