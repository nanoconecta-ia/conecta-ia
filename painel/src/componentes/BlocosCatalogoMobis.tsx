import { useState } from "react";
import { IconePeca } from "./IconePeca.tsx";
import { MONTADORAS_MOBIS, modelosAprovadosDaMontadora, nosPublicaveis, type CategoriaPublica, type MontadoraMobis } from "../lib/blocosCatalogoMobis.ts";

/** Bloco 03: montadoras → modelos retornados pela API Conecta.IA (aplicações aprovadas).
 * Nomes de montadoras são caminhos de consulta, não homologação, vínculo ou disponibilidade.
 */
export function BlocoMontadorasMobis({
  modelos, logos, aoSelecionarModelo, aoConsultar,
}:{
  modelos:readonly string[];
  logos?:Readonly<Record<string,string>>;
  aoSelecionarModelo:(modelo:string)=>void;
  aoConsultar:(montadora:string)=>void;
}){
  const [ativa,setAtiva]=useState<MontadoraMobis|null>(null);
  const encontrados=ativa?modelosAprovadosDaMontadora(ativa,modelos):[];
  return <section id="m2-montadoras" data-bloco="montadoras" className="m2-wrap m4-bloco-nos m4-bloco-montadoras" aria-label="Escolha uma montadora">
    <div className="m4-bloco-nos-titulo">
      <div><span className="m2-kicker">01 · MONTADORAS</span><h2>Escolha a montadora</h2>
        <p>Consulte as linhas diesel atendidas. Só modelos com aplicação liberada aparecem como filtro de produtos.</p>
      </div>
    </div>
    <div className="m4-montadoras-grade">
      {MONTADORAS_MOBIS.map(m=>{
        const total=modelosAprovadosDaMontadora(m.nome,modelos).length;
        return <button type="button" key={m.nome} aria-pressed={ativa===m.nome}
          className={"m4-montadora-item"+(ativa===m.nome?" selecionada":"")} onClick={()=>setAtiva(a=>a===m.nome?null:m.nome)}>
          {logos?.[m.nome]&&<img className="m4-logo-montadora" src={logos[m.nome]} alt={"Logotipo de "+m.nome} loading="lazy"/>}
          <strong>{m.nome}</strong><small>{total?total+" modelo(s) no catálogo":"Atendimento sob consulta"}</small>
        </button>;
      })}
    </div>
    {ativa&&<div className="m4-montadora-modelos" aria-live="polite">
      <div><strong>{ativa} · escolha o veículo</strong>
        <p>{encontrados.length?"Selecione um modelo com aplicação cadastrada:":"Ainda não há modelos desta montadora liberados para consulta por filtro."}</p>
      </div>
      <div className="m4-montadora-opcoes">
        {encontrados.map(m=><button type="button" key={m} onClick={()=>aoSelecionarModelo(m)}>{m} <span aria-hidden="true">→</span></button>)}
        <button type="button" onClick={()=>aoConsultar(ativa)}>Consultar a equipe <span aria-hidden="true">→</span></button>
      </div>
    </div>}
    <small className="m4-bloco-nos-nota">Referências de atendimento. Não representam associação oficial com as montadoras. Confirme cada aplicação por chassi, motorização e ano.</small>
  </section>;
}

const SISTEMAS_CONSULTA=[
  {nome:"Motor",icone:"motor"},
  {nome:"Suspensão",icone:"suspensao"},
  {nome:"Transmissão",icone:"transmissao"},
  {nome:"Freios",icone:"freios"},
  {nome:"Arrefecimento",icone:"arrefecimento"},
  {nome:"Elétrica",icone:"eletrica"},
] as const;
function iconeDaTaxonomia(nome:string,slug:string):string{
  const x=(nome+" "+slug).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/suspens|bandeja|amortec/.test(x))return "suspensao";
  if(/freio/.test(x))return "freios";
  if(/transmiss|embreagem|cambio/.test(x))return "transmissao";
  if(/arrefec|radiador/.test(x))return "arrefecimento";
  if(/eletric|alternador|sensor/.test(x))return "eletrica";
  return "motor";
}
/** Bloco 04: taxonomia = nós com contagem retornada pela API pública.
 * Nenhuma categoria pendente no Conecta.IA é mostrada como produto disponível.
 */
export function BlocoTaxonomiaMobis({
  categorias, aoSelecionarCategoria, aoConsultar,
}:{
  categorias:readonly CategoriaPublica[];
  aoSelecionarCategoria:(slug:string)=>void;
  aoConsultar:(sistema:string)=>void;
}){
  const nos=nosPublicaveis(categorias);
  return <section id="m2-taxonomia" data-bloco="taxonomia" className="m4-bloco-nos m4-bloco-taxonomia" aria-label="Escolha o sistema da peça">
    <div className="m2-wrap">
      <div className="m4-bloco-nos-titulo"><div><span className="m2-kicker">02 · SISTEMAS DO VEÍCULO</span>
        <h2>Encontre pelo sistema da peça</h2><p>Taxonomia ligada ao cadastro do Conecta.IA. Só itens liberados entram na listagem de produtos.</p>
      </div></div>
      <div className="m4-taxonomia-grade">
        {nos.length?nos.map(n=><button type="button" key={n.slug} className="m4-taxonomia-item"
          onClick={()=>aoSelecionarCategoria(n.slug)} data-taxonomia-no={n.slug}>
          <IconePeca nome={iconeDaTaxonomia(n.nome,n.slug)} tamanho={54}/>
          <strong>{n.nome}</strong><small>{n.total} produto(s) no catálogo</small><span>Ver peças →</span>
        </button>):
        SISTEMAS_CONSULTA.map(s=><button type="button" key={s.nome} className="m4-taxonomia-item"
          onClick={()=>aoConsultar(s.nome)} title={"Consultar peças de "+s.nome}>
          <IconePeca nome={s.icone} tamanho={54}/>
          <strong>{s.nome}</strong><small>Aguardando itens liberados</small><span>Consultar →</span>
        </button>)}
      </div>
      <small className="m4-bloco-nos-nota">{nos.length
        ?"As categorias vêm dos nós dos produtos apresentados pelo Conecta.IA. A aplicação por veículo depende de aprovação técnica."
        :"Os ícones representam sistemas de peças, não produtos cadastrados, marcas ou compatibilidade aprovada."}</small>
    </div>
  </section>;
}
