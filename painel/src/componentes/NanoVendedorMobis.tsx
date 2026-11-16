import { useState } from "react";

/** Guia visual roteirizado: não se passa por verificador técnico, não faz afirmações OEM.
 * Slots de imagem 3D original podem ser substituídos por ativos aprovados na biblioteca.
 */
type Gesto="apresentar"|"explicar"|"acolher";
const conteudo:Record<Gesto,{nome:string;titulo:string;mensagem:string}>={
  apresentar:{nome:"Apresentar",titulo:"Veja o produto verdadeiro",
    mensagem:"A fotografia em destaque representa a peça comercializada. Use as setas e o zoom para conferir os detalhes."},
  explicar:{nome:"Explicar",titulo:"Entenda os dados técnicos",
    mensagem:"Abra as abas de composição, OEM, códigos cruzados e história do veículo. A história não comprova compatibilidade; confira motor, ano e chassi."},
  acolher:{nome:"Consultar",titulo:"Converse com a equipe MOBIS",
    mensagem:"Antes da compra, confirme versão, código original, aplicação, garantia e disponibilidade. Nossa equipe pode ajudar pelo WhatsApp."},
};
export function NanoVendedorMobis({whatsapp,gestos={
  apresentar:null,explicar:null,acolher:null
}}:{
  whatsapp?:string|null;
  gestos?:Partial<Record<Gesto,string|null>>;
}){
  const [gesto,setGesto]=useState<Gesto>("apresentar");
  const item=conteudo[gesto];
  return <aside className="m2-nano" aria-label="Nano — orientação comercial da MOBIS">
    <div className="m2-nano-figura" aria-hidden="true">
      {gestos[gesto]?<img src={gestos[gesto]!} alt=""/>:
        <svg width="112" height="124" viewBox="0 0 112 124" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="nano-camisa" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e4aa72"/><stop offset=".55" stopColor="#303e42"/><stop offset="1" stopColor="#111b1f"/></linearGradient>
            <radialGradient id="nano-rosto"><stop stopColor="#e6ad7a"/><stop offset="1" stopColor="#b57052"/></radialGradient></defs>
          <ellipse cx="56" cy="116" rx="40" ry="6" fill="#12262e" opacity=".18"/>
          <rect x="38" y="75" width="16" height="41" rx="5" fill="#202b30"/><rect x="58" y="75" width="16" height="41" rx="5" fill="#202b30"/>
          <rect x="29" y="40" width="53" height="46" rx="15" fill="url(#nano-camisa)" stroke="#e58b43" strokeWidth="2.5"/>
          <rect x="18" y="47" width="13" height="35" rx="6" fill="#bd805c" transform={gesto==="acolher"?"rotate(-24 25 51)":"rotate(15 25 51)"}/>
          <rect x="82" y="46" width="13" height="36" rx="6" fill="#be8060" transform={gesto==="explicar"?"rotate(-59 86 50)":gesto==="apresentar"?"rotate(44 86 50)":"rotate(10 86 50)"}/>
          <rect x="44" y="7" width="27" height="34" rx="13" fill="url(#nano-rosto)"/>
          <path d="M43 23Q44 2 56 6Q72 2 73 23Q66 12 55 15Q49 16 43 23Z" fill="#29201e"/>
          <circle cx="51" cy="26" r="1.9" fill="#17232a"/><circle cx="63" cy="26" r="1.9" fill="#17232a"/>
          <path d="M52 33q5 5 10 0" fill="none" stroke="#522a20" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M43 41l13 13 14-13" fill="none" stroke="#f59b56" strokeWidth="2"/>
        </svg>}
    </div>
    <div className="m2-nano-texto">
      <small>SCOTT NANO · GUIA VISUAL</small>
      <strong>{item.titulo}</strong>
      <p>{item.mensagem}</p>
      <div className="m2-nano-gestos" role="group" aria-label="Orientações do Nano">
        {(Object.keys(conteudo) as Gesto[]).map(g=><button key={g} type="button"
          aria-pressed={gesto===g} onClick={()=>setGesto(g)}>{conteudo[g].nome}</button>)}
      </div>
      {gesto==="acolher"&&whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}
    </div>
  </aside>;
}
