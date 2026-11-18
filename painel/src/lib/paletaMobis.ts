/** Paleta de vitrine Mobis: cinco tokens, sem mudar marca, tipografia, imagens ou logo.
 * Cada paleta pode ser um rascunho; apenas a aprovada e publicada chega à loja.
 */
export type PaletaMobis={
  cor_fundo:string;
  cor_superficie:string;
  cor_texto:string;
  cor_botao:string;
  cor_acento:string;
};
/** Tokens exclusivos da loja MOBIS; o Conecta.IA mantém sua própria marca. */
export const PALETA_MOBIS_PADRAO:PaletaMobis={
  cor_fundo:"#ffffff",
  cor_superficie:"#eaf2f6",
  cor_texto:"#1f2327",
  cor_botao:"#1f2327",
  cor_acento:"#e2181a",
};
export const MODELOS_PALETA_MOBIS=[
 {id:"gelo",nome:"Branco-gelo oficial",descricao:"Produtos em gelo; grafite e vermelho MOBIS",cores:PALETA_MOBIS_PADRAO},
 {id:"neve",nome:"Branco institucional",descricao:"Branco com cartões gelo, botão vermelho e tipografia grafite",cores:{
   cor_fundo:"#ffffff",cor_superficie:"#eaf2f6",cor_texto:"#1f2327",cor_botao:"#e2181a",cor_acento:"#e2181a",
 }},
 {id:"reverso",nome:"Gelo predominante",descricao:"Fundo branco-gelo e cartão branco, mantendo o vermelho e o grafite",cores:{
   cor_fundo:"#eaf2f6",cor_superficie:"#ffffff",cor_texto:"#1f2327",cor_botao:"#1f2327",cor_acento:"#e2181a",
 }},
] as const;
const hex=/^#[0-9a-f]{6}$/;
export function luminancia(cor:string):number{
 const partes=[1,3,5].map(i=>parseInt(cor.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
 return partes[0]*.2126+partes[1]*.7152+partes[2]*.0722;
}
export function contraste(a:string,b:string):number{
 const x=luminancia(a),y=luminancia(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function validarPaletaMobis(v:unknown):{ok:true;cores:PaletaMobis}|{ok:false;erro:string}{
 if(!v||typeof v!=="object")return {ok:false,erro:"Selecione uma paleta de cores."};
 const obj=v as Record<string,unknown>;
 const keys=["cor_fundo","cor_superficie","cor_texto","cor_botao","cor_acento"] as const;
 for(const key of keys)if(typeof obj[key]!=="string"||!hex.test(obj[key]))return {ok:false,erro:"Cada cor precisa estar no formato #rrggbb."};
 const cores=Object.fromEntries(keys.map(k=>[k,obj[k]])) as PaletaMobis;
 // A loja Mobis não aceita mais temas históricos com laranja/cobre.
 if(cores.cor_acento!=="#e2181a")
  return {ok:false,erro:"O destaque institucional da MOBIS deve ser vermelho #E2181A."};
 if(!["#ffffff","#eaf2f6"].includes(cores.cor_fundo) || !["#ffffff","#eaf2f6"].includes(cores.cor_superficie))
  return {ok:false,erro:"Use branco ou branco-gelo nas superfícies da MOBIS."};
 if(luminancia(cores.cor_fundo)<.75||luminancia(cores.cor_superficie)<.75)
  return {ok:false,erro:"Escolha branco neve ou gelo como superfícies da vitrine."};
 if(contraste(cores.cor_texto,cores.cor_fundo)<4.5||contraste(cores.cor_texto,cores.cor_superficie)<4.5)
  return {ok:false,erro:"Contraste insuficiente entre texto e superfícies (WCAG AA)."};
 if(contraste(cores.cor_botao,"#ffffff")<4.5||contraste(cores.cor_acento,"#ffffff")<4.5)
  return {ok:false,erro:"Botões e acentos devem contrastar com texto branco (WCAG AA)."};
 return {ok:true,cores};
}
export function paletaPublicada(v:unknown):PaletaMobis|null{
 const res=validarPaletaMobis(v);
 return res.ok?res.cores:null;
}
export function variaveisPaletaMobis(cores:PaletaMobis):Record<string,string>{
 return {"--mobis-fundo":cores.cor_fundo,"--mobis-superficie":cores.cor_superficie,
  "--mobis-texto":cores.cor_texto,"--mobis-botao":cores.cor_botao,"--mobis-acento":cores.cor_acento};
}
