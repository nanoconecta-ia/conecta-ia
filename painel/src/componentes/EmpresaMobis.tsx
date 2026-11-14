import { useState } from "react";

/** Abas "A Mobis" e "Onde estamos". Só afirma o que o proprietário informou; o mapa do Google só carrega ao clicar. */
const ENDERECO = "Avenida T-9, nº 3492, Jardim América, Goiânia - GO";
const consulta = encodeURIComponent("Avenida T-9, 3492, Jardim América, Goiânia - GO");

export function EmpresaMobis({whatsapp}:{whatsapp:string|null}) {
  const [aba,setAba]=useState<"sobre"|"onde">("sobre");
  const [mapa,setMapa]=useState(false);
  return <section id="m2-empresa" className="m2-wrap m2-secao m2-empresa" aria-label="Sobre a Mobis e localização">
    <div className="m2-empresa-abas" role="tablist" aria-label="Informações da empresa">
      <button role="tab" id="m2-aba-sobre" aria-selected={aba==="sobre"} aria-controls="m2-painel-sobre" onClick={()=>setAba("sobre")}>A Mobis</button>
      <button role="tab" id="m2-aba-onde" aria-selected={aba==="onde"} aria-controls="m2-painel-onde" onClick={()=>setAba("onde")}>Onde estamos</button>
    </div>
    {aba==="sobre"&&<div role="tabpanel" id="m2-painel-sobre" aria-labelledby="m2-aba-sobre" className="m2-empresa-painel">
      <h2>Empresa de família, há mais de 14 anos vendendo autopeças</h2>
      <p>A Mobis nasceu em Anápolis e hoje atende de Goiânia. Trabalhamos com peças para picapes, vans e utilitários e despachamos para todo o Brasil.</p>
      <ul><li>Mais de 14 anos no mercado de autopeças</li><li>Empresa familiar, atendimento direto com quem entende da peça</li><li>Envio para todo o território nacional</li></ul>
      {whatsapp&&<a className="m2-empresa-cta" href={whatsapp} target="_blank" rel="noopener noreferrer">Falar com a Mobis no WhatsApp ↗</a>}
    </div>}
    {aba==="onde"&&<div role="tabpanel" id="m2-painel-onde" aria-labelledby="m2-aba-onde" className="m2-empresa-painel">
      <h2>Venha nos visitar</h2>
      <address>{ENDERECO}</address>
      <div className="m2-empresa-acoes">
        <a href={"https://www.google.com/maps/dir/?api=1&destination="+consulta} target="_blank" rel="noopener noreferrer">Traçar rota no Google Maps ↗</a>
        {!mapa&&<button type="button" onClick={()=>setMapa(true)}>Ver mapa aqui</button>}
      </div>
      {mapa&&<iframe title="Mapa da loja Mobis" className="m2-empresa-mapa" loading="lazy" referrerPolicy="no-referrer" src={"https://www.google.com/maps?q="+consulta+"&output=embed"}/>}
      <p className="m2-empresa-nota">Ao ver o mapa aqui, o Google Maps é carregado pelo seu navegador.</p>
    </div>}
  </section>;
}
