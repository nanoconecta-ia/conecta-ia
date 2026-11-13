/** Triagem informativa, nunca cálculo/parametrização tributária e nunca autorização de pagamento.
 * Todos os dados recebidos da loja são classificações, não CPF/CNPJ, nome, IE, banco ou endereço.
 */
export const UFS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
] as const;
export type UF = typeof UFS_BR[number];
export type Comprador = "cpf" | "cnpj";
export type Contribuinte = "sim" | "nao" | "nao_sei";
export type Finalidade = "uso_consumo" | "revenda" | "ativo_imobilizado";
export type Situacao = "apto_consulta" | "restrito" | "analise_fiscal";

export type Entrada = {
  slug: string; sku: string; uf_destino: UF; tipo_destinatario: Comprador;
  contribuinte_icms: Contribuinte; finalidade: Finalidade;
};
export type RegraFiscal = {
  uf_destino: string; tipo_destinatario: string; contribuinte_icms: string; finalidade: string;
  decisao: string; status: string; fundamento_normativo: string | null; fonte_oficial: string | null;
  validado_por_contador: string | null; validado_em: string | null;
  inicio_vigencia: string; fim_vigencia: string | null;
};
export type ContextoFiscal = {
  fase: string;
  lojaFiscal: { uf: string | null; regime: string | null; validado_em: string | null } | null;
  produtoFiscal: { status: string; ncm: string | null; validado_em: string | null } | null;
  regra: RegraFiscal | null;
  hoje: string;
};
export type Resultado = {
  situacao: Situacao; pode_concluir_pedido: false; encaminhar_erp: false;
  mensagem: string; revisao_contador: boolean;
};
export const analise = (mensagem: string): Resultado => ({
  situacao:"analise_fiscal", pode_concluir_pedido:false, encaminhar_erp:false,
  mensagem, revisao_contador:true
});
const textoCurto=(v:unknown,max:number)=>typeof v==="string" && v.length<=max && !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : "";
export function validarEntrada(x:unknown): Entrada | null {
  if(!x || typeof x!=="object") return null;
  const a=x as Record<string,unknown>;
  const slug=textoCurto(a.slug,63),sku=textoCurto(a.sku,80);
  const uf=a.uf_destino,tipo=a.tipo_destinatario,contrib=a.contribuinte_icms,fin=a.finalidade;
  if(!/^[a-z0-9-]{2,63}$/.test(slug) || sku.length===0 ||
     !(UFS_BR as readonly unknown[]).includes(uf) ||
     !["cpf","cnpj"].includes(String(tipo)) ||
     !["sim","nao","nao_sei"].includes(String(contrib)) ||
     !["uso_consumo","revenda","ativo_imobilizado"].includes(String(fin))) return null;
  return {slug,sku,uf_destino:uf as UF,tipo_destinatario:tipo as Comprador,
    contribuinte_icms:contrib as Contribuinte,finalidade:fin as Finalidade};
}
const dataISO=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "0000-00-00";
/** Estritamente conservador. Sem linha fiscal validada => SEM autorização.
 * Mesmo a saída "apto_consulta" só abre cotação, nunca compra automática.
 */
export function avaliarFiscal(e:Entrada,c:ContextoFiscal): Resultado {
  if(c.fase!=="producao") return analise("Loja em teste: a contratação está desabilitada.");
  if(e.contribuinte_icms==="nao_sei") return analise("Informe ao vendedor se o destinatário contribui para o ICMS. Nenhum dado de documento é necessário nesta tela.");
  if(!c.lojaFiscal?.uf || !c.lojaFiscal.regime || !c.lojaFiscal.validado_em)
    return analise("A configuração fiscal da loja ainda não foi validada pelo contador.");
  if(c.produtoFiscal?.status!=="validado" || !c.produtoFiscal.ncm || !c.produtoFiscal.validado_em)
    return analise("A classificação tributária desta peça aguarda revisão.");
  const r=c.regra;
  if(!r || r.status!=="validada" || !r.validado_em || !r.validado_por_contador ||
    !r.fundamento_normativo || !r.fonte_oficial ||
    r.uf_destino!==e.uf_destino || r.tipo_destinatario!==e.tipo_destinatario ||
    r.contribuinte_icms!==e.contribuinte_icms || r.finalidade!==e.finalidade ||
    dataISO(r.inicio_vigencia)>c.hoje || (r.fim_vigencia && dataISO(r.fim_vigencia)<c.hoje))
    return analise("Não há regra fiscal vigente e validada para esta combinação de produto, UF, comprador e finalidade.");
  if(r.decisao==="bloquear") return {
    situacao:"restrito",pode_concluir_pedido:false,encaminhar_erp:false,revisao_contador:false,
    mensagem:"Esta modalidade de venda está restrita pela regra cadastrada da loja. Consulte o atendimento para avaliar uma alternativa permitida."
  };
  if(r.decisao==="liberar_atendimento") return {
    situacao:"apto_consulta",pode_concluir_pedido:false,encaminhar_erp:false,revisao_contador:false,
    mensagem:"Condições preliminares compatíveis com a política fiscal cadastrada. A venda, os tributos e os documentos ainda precisam ser confirmados no Bling."
  };
  return analise("A regra não autoriza uma decisão automática. Consulte a equipe fiscal.");
}
