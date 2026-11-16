/** Validação conservadora antes de preparar um feed Google Merchant.
 * Não cria feed, anúncios, ofertas nem altera Bling.
 * Referência: https://support.google.com/merchants/answer/7052112?hl=pt-br
 */
export type RegistroShoppingMobis={
  id:string;titulo:string;descricao:string;marca:string|null;
  gtin?:string|null;mpn?:string|null;
  textoGeradoPorIA:boolean;
  aplicacaoAprovada:boolean;fotoRealAutorizada:boolean;
  preco:number|null;disponibilidadeConfirmada:boolean;
};
export type AnaliseShoppingMobis={
  bloqueios:string[];avisos:string[];
  tipoTitulo:"structured_title"|"title";
  tipoDescricao:"structured_description"|"description";
  tipoOrigemIA:"trained_algorithmic_media"|"default";
};
export function verificarGtin(gtin:string):boolean{
  const n=gtin.replace(/[ -]/g,"");
  if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(n))return false;
  let soma=0;
  for(let i=n.length-2,peso=3;i>=0;i--,peso=peso===3?1:3)soma+=Number(n[i])*peso;
  return (10-soma%10)%10===Number(n[n.length-1]);
}
export function analisarShoppingMobis(p:RegistroShoppingMobis):AnaliseShoppingMobis{
  const bloqueios:string[]=[],avisos:string[]=[];
  const titulo=p.titulo.trim(),descricao=p.descricao.trim();
  if(!p.id.trim()||p.id.length>50)bloqueios.push("ID obrigatório com máximo de 50 caracteres.");
  if(!titulo||titulo.length>150)bloqueios.push("Título vazio ou acima de 150 caracteres.");
  if(!descricao||descricao.length>5000)bloqueios.push("Descrição vazia ou acima de 5.000 caracteres.");
  if(!p.marca?.trim() || p.marca.trim().length>70)avisos.push("Marca real ausente ou longa: verificar atributo brand.");
  if(p.gtin&&!verificarGtin(p.gtin))bloqueios.push("GTIN sem formato/dígito verificador válido.");
  if(p.mpn&&p.mpn.length>70)bloqueios.push("MPN acima de 70 caracteres.");
  if(!p.aplicacaoAprovada)bloqueios.push("Aplicação não homologada.");
  if(!p.fotoRealAutorizada)bloqueios.push("Foto real ainda não aprovada.");
  if(p.preco==null||p.preco<=0||!Number.isFinite(p.preco))bloqueios.push("Preço verificado ausente.");
  if(!p.disponibilidadeConfirmada)bloqueios.push("Disponibilidade não confirmada.");
  if(titulo.length>70)avisos.push("Título acima dos ~70 caracteres recomendados para maior visibilidade.");
  if(descricao.length<500||descricao.length>1000)avisos.push("Revisar primeiros 160–500 caracteres; ~500–1.000 é faixa sugerida.");
  return {bloqueios,avisos,
    tipoTitulo:p.textoGeradoPorIA?"structured_title":"title",
    tipoDescricao:p.textoGeradoPorIA?"structured_description":"description",
    tipoOrigemIA:p.textoGeradoPorIA?"trained_algorithmic_media":"default"};
}
