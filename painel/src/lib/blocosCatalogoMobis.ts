/**
 * Contrato de composição da vitrine Mobis — Bling > Conecta.IA > blocos públicos.
 * Origem técnica: espelho do Bling em leitura; nós, evidências e aprovações são da camada Conecta.IA.
 * Não há qualquer chamada de escrita, nem permissão para clonar o SKU físico ou emitir NF.
 */
export const BLOCOS_MOBIS = [
  {id:"cabecalho",origem:"lojas + identidade aprovada",destino:"navegacao"},
  {id:"banner",origem:"loja_banners + produtos publicados + imagens_publicaveis",destino:"ficha_sku"},
  {id:"montadoras",origem:"produto_aplicacoes aprovadas / veiculos_da_vitrine",destino:"filtro_modelo"},
  {id:"taxonomia",origem:"taxonomia_nos dos produtos publicados",destino:"filtro_categoria"},
  {id:"produtos",origem:"produtos espelhados publicados + codigos/aplicacoes aprovados",destino:"pagina_sku"},
  {id:"privacidade",origem:"loja_politicas com status aprovada",destino:"rodape"},
] as const;

export const MONTADORAS_MOBIS = [
  {nome:"Hyundai",identificadores:["Hyundai","HR"]},
  {nome:"Kia",identificadores:["Kia","Bongo","K2500"]},
  {nome:"Mitsubishi",identificadores:["Mitsubishi","L200","Pajero"]},
  {nome:"Ford",identificadores:["Ford","Ranger","Transit"]},
  {nome:"Mercedes-Benz",identificadores:["Mercedes","Mercedes-Benz","Sprinter"]},
  {nome:"Iveco",identificadores:["Iveco","Daily"]},
  {nome:"Fiat",identificadores:["Fiat","Ducato"]},
  {nome:"Peugeot",identificadores:["Peugeot","Boxer"]},
  {nome:"Citroën",identificadores:["Citroen","Citroën","Jumper"]},
] as const;

export type MontadoraMobis = (typeof MONTADORAS_MOBIS)[number]["nome"];
export type CategoriaPublica = {nome:string;slug:string;total:number};
const normalizar=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

/** Usado só para navegação: correspondência textual não prova compatibilidade de peça. */
export function modelosAprovadosDaMontadora(marca:MontadoraMobis, modelos:readonly string[]):string[]{
  const ref=MONTADORAS_MOBIS.find(x=>x.nome===marca);
  if(!ref)return [];
  const ids=ref.identificadores.map(normalizar);
  return [...new Set(modelos.filter(m=>{
    const s=normalizar(m);
    return ids.some(id=>s===id || s.startsWith(id+" ") || s.endsWith(" "+id));
  }))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
/** Somente nós retornados pela API da loja (já filtrados por publicação). */
export function nosPublicaveis(categorias:readonly CategoriaPublica[]):CategoriaPublica[]{
  const vistos=new Set<string>();
  return categorias.filter(c=>{
    if(!c.slug||!c.nome||!Number.isFinite(c.total)||c.total<=0||vistos.has(c.slug))return false;
    vistos.add(c.slug);
    return true;
  }).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
}
/** Proposta do agente: nunca significa novo produto no Bling ou visibilidade pública. */
export type PropostaNoCatalogo={
  skuFisico:string|null;
  especie:"enriquecimento"|"nova_ficha_conecta"|"aplicacao_veicular";
  fontes:{referencia:string;data:string}[];
  status:"a_confirmar"|"em_revisao"|"aprovado";
  visivel:boolean;
  automacaoPausada:boolean;
};
export function permiteExibirProposta(p:PropostaNoCatalogo):boolean{
  return p.status==="aprovado"&&p.visivel&&!p.automacaoPausada&&p.fontes.length>0;
}
