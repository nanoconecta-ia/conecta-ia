// Página filha por aplicação, independente do SKU físico. Não recebe custo,
// estoque ou oferta. Prova de homologação estruturada só pode vir de adaptador
// de auditoria confiável, nunca do texto legado nem do agente.
import {esc,truncar} from "./escape.ts";
import {produtoIndexavel,textoSimples,type LojaSeo,type ProdutoSeo,type IdentidadeProdutoSeo} from "./dados.ts";
import {baseUrl,caminhoProduto} from "./url.ts";
export interface AplicacaoSeo {
 slug:string;sku:string;titulo:string|null;descricao:string|null;modelo:string;
 motor:string|null;inicio:number|null;fim:number|null;oem:string|null;restricao:string|null;
 contraindicacao:string|null;status:string;visivel:boolean;modeloId:string|null;fonte:string|null;coletadoEm:string|null;
 // Não é persistida nem inferida nesta etapa. Adaptador futuro deve verificar
 // prova por versão/mercado BR/código e aprovação independente na revisão atual.
 prova?:{revisao:string;referencia:string;aplicacaoSlug:string;sku:string;modeloId:string;motor:string;inicio:number;fim:number;oem:string;mercado:"BR";validada:boolean};
}
/** Projeção única dos campos legados selecionados pelos dois adaptadores públicos.
 * Whitelist explícita: não copia prova, preço, estoque, dados privados nem IDs internos.
 * A flag antiga representa visibilidade de consulta, não autoridade de indexação.
 */
export interface RegistroAplicacaoLegada {
 pagina_slug:string|null;pagina_titulo:string|null;pagina_descricao:string|null;modelo:string|null;
 motorizacao:string|null;ano_inicial:number|null;ano_final:number|null;codigo_oem:string|null;
 restricao:string|null;contraindicacao:string|null;status:string;pagina_indexavel:boolean;
 modelo_id:string|null;fonte:string|null;coletado_em:string|null;
}
export function projetarAplicacaoLegada(a:RegistroAplicacaoLegada,sku:string):AplicacaoSeo{
 return {slug:a.pagina_slug??"",sku,titulo:a.pagina_titulo,descricao:a.pagina_descricao,modelo:a.modelo??"",motor:a.motorizacao,inicio:a.ano_inicial,fim:a.ano_final,oem:a.codigo_oem,restricao:a.restricao,contraindicacao:a.contraindicacao,status:a.status,visivel:a.pagina_indexavel,modeloId:a.modelo_id,fonte:a.fonte,coletadoEm:a.coletado_em};
}
export const slugAplicacaoValido=(s:string)=>/^[a-z0-9-]{4,110}$/.test(s);
export const caminhoAplicacao=(s:string)=>"/aplicacao/"+s;
const texto=(s:string|null)=>textoSimples(s,2000)??"";
const contradiz=(s:string|null)=>/\b(?:nao homologad[oa]s?|a homologar|sem homologacao|nao confirmad[oa]s?)\b/.test((s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase());
const ano=(x:number|null)=>x!==null&&Number.isInteger(x)&&x>=1950&&x<=2100;
export function paiDaAplicacao<T extends IdentidadeProdutoSeo>(a:AplicacaoSeo,ps:T[]):T|undefined{
 const pais=ps.filter(p=>p.sku===a.sku);
 return pais.length===1&&produtoIndexavel(pais[0])?pais[0]:undefined;
}
export function podeConsultarAplicacao(a:AplicacaoSeo,ps:IdentidadeProdutoSeo[]):boolean{
 return slugAplicacaoValido(a.slug)&&a.status==="aprovado"&&a.visivel===true&&!!a.modelo.trim()&&!!texto(a.titulo)&&!!paiDaAplicacao(a,ps)&&!!a.fonte?.trim()&&!!a.coletadoEm&&Number.isFinite(Date.parse(a.coletadoEm))&&!contradiz(a.fonte);
}
export function aplicacaoIndexavel(a:AplicacaoSeo,ps:ProdutoSeo[]):boolean{
 const p=a.prova;
 return podeConsultarAplicacao(a,ps)&&!!texto(a.descricao)&&!!a.modeloId&&!!a.motor?.trim()&&!!a.oem?.trim()&&ano(a.inicio)&&ano(a.fim)&&a.fim!>=a.inicio!&&!!p&&p.validada===true&&!!p.revisao.trim()&&!!p.referencia.trim()&&p.mercado==="BR"&&p.aplicacaoSlug===a.slug&&p.sku===a.sku&&p.modeloId===a.modeloId&&p.motor===a.motor&&p.inicio===a.inicio&&p.fim===a.fim&&p.oem===a.oem;
}
export function aplicacoesUnicas(aps:AplicacaoSeo[]):AplicacaoSeo[]{
 const cont=new Map<string,number>();
 for(const a of aps)cont.set(a.slug,(cont.get(a.slug)??0)+1);
 return aps.filter(a=>cont.get(a.slug)===1);
}
export function paginaAplicacaoHtml(loja:LojaSeo,a:AplicacaoSeo,ps:ProdutoSeo[]):string|null{
 if(!podeConsultarAplicacao(a,ps))return null;
 const p=paiDaAplicacao(a,ps)!;
 const base=baseUrl(loja.dominio),indexa=loja.ativa&&!!base&&aplicacaoIndexavel(a,ps);
 const titulo=indexa?texto(a.titulo):"Consulta de peça · "+a.modelo;
 const periodo=[a.inicio??"a confirmar",a.fim??"a confirmar"].join(" – ");
 const desc=indexa?texto(a.descricao):"Consulte a identificação da peça, o ano e o chassi com nossa equipe. Aplicação ainda sem comprovação técnica completa.";
 const canonical=indexa?base+caminhoAplicacao(a.slug):null;
 const img=[...p.imagens].filter(i=>i.tipo==="real"&&/^https:\/\//i.test(i.url)).sort((x,y)=>Number(y.principal)-Number(x.principal)||x.ordem-y.ordem)[0];
 const tel=(loja.whatsapp??"").replace(/\D/g,"");
 const link=/^55\d{10,11}$/.test(tel)?"https://wa.me/"+tel+"?text="+encodeURIComponent("Olá, quero conferir a aplicação "+a.modelo+", SKU "+a.sku+", pelo chassi e ano."):null;
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(truncar(titulo+" | "+loja.nome,70))+'</title><meta name="description" content="'+esc(truncar(desc,160))+'"><meta name="robots" content="'+(indexa?"index,follow":"noindex,nofollow")+'">'+(canonical?'<link rel="canonical" href="'+esc(canonical)+'">':"")+'<style>body{font-family:system-ui,sans-serif;margin:auto;max-width:48rem;padding:1rem;line-height:1.5;color:#24292e}img{max-width:100%;height:auto}dd{overflow-wrap:anywhere}a{color:#a90013}</style></head><body><header><a href="/">'+esc(loja.nome)+'</a></header><main><article><h1>'+esc(titulo)+'</h1><p>'+esc(desc)+'</p>'+(img?'<img src="'+esc(img.url)+'" alt="'+esc("Foto da peça SKU "+a.sku)+'">':"")+'<dl><dt>SKU físico</dt><dd>'+esc(a.sku)+'</dd><dt>Veículo registrado</dt><dd>'+esc(a.modelo)+'</dd><dt>Motor registrado</dt><dd>'+esc(a.motor??"A confirmar")+'</dd><dt>Período registrado</dt><dd>'+esc(periodo)+'</dd>'+(indexa?'<dt>OEM desta aplicação</dt><dd>'+esc(a.oem)+'</dd>':"")+'</dl>'+(a.restricao?'<p>Restrições registradas: '+esc(texto(a.restricao))+'</p>':"")+(a.contraindicacao?'<p>Contraindicações registradas: '+esc(texto(a.contraindicacao))+'</p>':"")+'<p>Preço sob consulta. Confirme pelo chassi antes da compra.</p><p><a href="'+esc(caminhoProduto(a.sku))+'">Ver produto físico</a></p>'+(link?'<p><a href="'+esc(link)+'">Consultar aplicação</a></p>':"")+'</article></main></body></html>';
}
