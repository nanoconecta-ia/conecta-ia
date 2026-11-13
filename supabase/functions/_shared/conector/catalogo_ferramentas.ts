// Contrato público fechado para o painel "Indexar e enriquecer".
// Não aceita edição fiscal, preço, estoque, cliente ou autorização de escrita.
// Os handlers reais são os do registro central do Nano, sempre via Policy Engine.
export const ACOES_CATALOGO = ["consultar_bling", "propor_conecta", "preparar_erp"] as const;
export type AcaoCatalogo = typeof ACOES_CATALOGO[number];
export const CAMPOS_CONECTA = [
  "marca_peca", "descricao_curta", "descricao_longa", "tags", "seo_titulo", "seo_descricao"
] as const;
export const CAMPOS_ERP = ["descricao_curta", "descricao_complementar"] as const;
export type AcaoValidada = { ferramenta: string; entrada: Record<string, unknown> };
const SKU = /^[\p{L}\p{N}._/+ -]{1,80}$/u;
const SUJEIRA = /[\u0000-\u001f\u007f]/;
const texto = (v: unknown, min: number, max: number): string | null =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max && !SUJEIRA.test(v)
    ? v.trim() : null;

/** Erro seguro para retorno ao usuário (não contém o valor bruto submetido). */
export function validarAcaoCatalogo(raw: unknown): { ok: true; dados: AcaoValidada } | { ok: false; erro: string } {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const acao = p.acao;
  if (!ACOES_CATALOGO.includes(acao as AcaoCatalogo)) return {ok:false,erro:"Ação fora da lista autorizada."};
  const sku = texto(p.sku,1,80);
  if (!sku || !SKU.test(sku)) return {ok:false,erro:"Informe um SKU válido de até 80 caracteres."};
  if (acao === "consultar_bling") {
    return {ok:true,dados:{ferramenta:"bling.produtos.consultar",entrada:{sku}}};
  }
  const campo = texto(p.campo,3,40);
  const valor = texto(p.valor,2,4000);
  const fonte = texto(p.fonte,6,500);
  if (!campo || !valor || !fonte) return {ok:false,erro:"Campo, conteúdo e fonte documental são obrigatórios."};
  // Não aceitar identificadores/URLs de documentos internos ou valores sensíveis no conteúdo livre.
  if (/(?:\b(?:cpf|cnpj|senha|cart[aã]o|chave pix|dados banc[aá]rios)\b\s*[:=])/i.test(valor))
    return {ok:false,erro:"Remova dados pessoais e financeiros do conteúdo técnico."};
  if (acao === "propor_conecta") {
    if (!(CAMPOS_CONECTA as readonly string[]).includes(campo))
      return {ok:false,erro:"Campo não permitido para enriquecimento da camada Conecta.IA."};
    return {ok:true,dados:{ferramenta:"conecta.enriquecimento.propor",entrada:{sku,campo,valor,fonte}}};
  }
  if (!(CAMPOS_ERP as readonly string[]).includes(campo))
    return {ok:false,erro:"Somente descrições técnicas podem ser preparadas nesta ferramenta; os demais campos exigem revisão específica."};
  const fonteEstruturada = /^https:\/\//i.test(fonte) ? {url:fonte,consultado_em:new Date().toISOString().slice(0,10)} :
    {documento:fonte,consultado_em:new Date().toISOString().slice(0,10)};
  return {ok:true,dados:{
    ferramenta:"bling.produtos.preparar_atualizacao",
    entrada:{sku,campos:{[campo]:valor},fontes:[fonteEstruturada]}
  }};
}