import { useState } from "react";
import type { PoliticasLojaPublicas } from "./RodapeLoja.tsx";

/** Página institucional independente da vitrine; endereço e identificação vêm apenas das políticas aprovadas. */
export function EmpresaMobis({whatsapp,politicas}:{
  whatsapp:string|null;politicas?:PoliticasLojaPublicas|null;
}) {
  const [aba,setAba]=useState<"sobre"|"onde">("sobre");
  const [mapa,setMapa]=useState(false);
  const endereco=politicas?.endereco?.trim()||"";
  const mapaUrl=endereco?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(endereco):null;
  return <section id="m2-empresa" className="m2-wrap m2-secao m2-empresa m4-empresa-dedicada" aria-label="Sobre a Mobis e contato">
    <a className="m4-voltar-catalogo" href="#/loja/mobis">← Voltar para a loja e os produtos</a>
    <span className="m2-kicker">MOBIS AUTOPEÇAS · INFORMAÇÕES DA EMPRESA</span>
    <h1>Conheça a Mobis</h1>
    <p>Loja brasileira independente, especializada em peças para picapes, vans e utilitários diesel.</p>
    <div className="m2-empresa-abas" role="tablist" aria-label="Informações da empresa">
      <button type="button" role="tab" id="m2-aba-sobre" aria-selected={aba==="sobre"} aria-controls="m2-painel-sobre" onClick={()=>setAba("sobre")}>Nossa atuação</button>
      <button type="button" role="tab" id="m2-aba-onde" aria-selected={aba==="onde"} aria-controls="m2-painel-onde" onClick={()=>setAba("onde")}>Contato e localização</button>
    </div>
    {aba==="sobre"&&<div role="tabpanel" id="m2-painel-sobre" aria-labelledby="m2-aba-sobre" className="m2-empresa-painel">
      <h2>Autopeças para quem trabalha com utilitários</h2>
      <p>Atendimento especializado para localizar a peça pelo modelo, motorização e referência. A compatibilidade é conferida antes da venda.</p>
      <p>A MOBIS AUTOPEÇAS é independente e não integra montadoras ou concessionárias. As marcas de veículos são usadas para identificar aplicações, sem representar vínculo ou endosso.</p>
      {whatsapp&&<a className="m2-empresa-cta" href={whatsapp} target="_blank" rel="noopener noreferrer">Falar com a Mobis no WhatsApp ↗</a>}
    </div>}
    {aba==="onde"&&<div role="tabpanel" id="m2-painel-onde" aria-labelledby="m2-aba-onde" className="m2-empresa-painel">
      <h2>Dados de atendimento e localização</h2>
      {politicas?.razao_social&&<p><strong>{politicas.razao_social}</strong></p>}
      {politicas?.cnpj&&<p>CNPJ: {politicas.cnpj}</p>}
      {endereco?<address>{endereco}</address>:<p>O endereço público está em conferência no cadastro da loja.</p>}
      {politicas?.telefone&&<p>Telefone: {politicas.telefone}</p>}
      {politicas?.email_contato&&<a href={"mailto:"+politicas.email_contato}>{politicas.email_contato}</a>}
      <div className="m2-empresa-acoes">
        {mapaUrl&&<a href={mapaUrl} target="_blank" rel="noopener noreferrer">Ver localização no Google Maps ↗</a>}
        {mapaUrl&&!mapa&&<button type="button" onClick={()=>setMapa(true)}>Abrir mapa na página</button>}
      </div>
      {mapa&&endereco&&<iframe title="Mapa da Mobis" className="m2-empresa-mapa" loading="lazy" referrerPolicy="no-referrer" src={"https://www.google.com/maps?q="+encodeURIComponent(endereco)+"&output=embed"}/>}
      {mapa&&<p className="m2-empresa-nota">O mapa externo é carregado pelo navegador somente após sua escolha.</p>}
    </div>}
  </section>;
}
