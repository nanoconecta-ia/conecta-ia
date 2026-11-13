import { useMemo, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import { useWorkspaceDados } from "../lib/workspaceDados.ts";
import { AtivoAprovado } from "../componentes/AtivoAprovado.tsx";

export function CatalogoAplicacao({loja}:{loja:Loja}){
 const [pagina,setPagina]=useState(1),[busca,setBusca]=useState(""),[q,setQ]=useState("");
 const [modelo,setModelo]=useState(""),[motor,setMotor]=useState(""),[ano,setAno]=useState(""),[sistema,setSistema]=useState("");
 const {dados,recarregar}=useWorkspaceDados(loja.id,pagina,q);
 const aplicacoes=dados?.aplicacoes??[],modelos=[...new Set(aplicacoes.map(a=>a.modelo).filter((v):v is string=>!!v))];
 const motores=[...new Set(aplicacoes.filter(a=>!modelo||a.modelo===modelo).map(a=>a.motorizacao).filter((v):v is string=>!!v))];
 const linhas=useMemo(()=> (dados?.produtos??[]).filter(p=>{
  if(sistema&&p.taxonomia_no_id!==sistema)return false;
  if(!modelo&&!motor&&!ano)return true;
  return aplicacoes.some(a=>a.produto_id===p.id&&a.status==="aprovado"&&(!modelo||a.modelo===modelo)&&(!motor||a.motorizacao===motor)&&(!ano||(a.ano_inicial!=null&&a.ano_final!=null&&Number(ano)>=a.ano_inicial&&Number(ano)<=a.ano_final)));
 }),[dados,modelo,motor,ano,sistema]);
 const limpar=()=>{setBusca("");setQ("");setModelo("");setMotor("");setAno("");setSistema("");setPagina(1);};
 const numero=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("pt-BR");
 function exportar(){
  const cel=(v:string)=>'"'+(/^[\s]*[=+\-@]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
  const csv="\uFEFF"+[["SKU","Produto","Marca","Situação"],...linhas.map(p=>[p.sku??"",p.nome??"",p.marca??"","Aplicação exige conferência técnica"])].map(r=>r.map(cel).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="conecta-revisao-catalogo.csv";a.click();URL.revokeObjectURL(url);
 }
 return <section className="ap-catalogo" data-catalogo-layout="aprovado-v2">
  <header className="ap-heading"><div><span className="ap-eyebrow">CONECTA.IA · ENRIQUECIMENTO INTERNO</span><h1>Catálogo por aplicação.</h1><p>Estruture aplicações independentes, preserve o produto físico e encontre cada peça.</p></div><div className="ap-heading-acoes"><button onClick={exportar} disabled={!linhas.length}>↓ Exportar recorte</button><a className="ap-primary" href="#/fila">Revisar propostas →</a></div></header>
  <div className="ap-notice"><AtivoAprovado nome="contexto" tamanho={25}/><span><b>Origem física no Bling.</b> Aplicações, evidências e revisão na Conecta.IA.</span><a href="#/ferramentas">Indexar e enriquecer ↗</a></div>
  <div className="ap-metricas">{[["Produtos encontrados",numero(dados?.total),"Busca no servidor"],["Aplicações homologadas",numero(dados?.aprovadas),"Dados registrados com aprovação"],["Fila de revisão",numero(dados?.fila),"Propostas pendentes"],["Produtos publicados",numero(dados?.publicados),"Liberados para a vitrine"]].map(([t,n,d])=><article key={t}><span>{t}</span><strong>{dados?n:"…"}</strong><small>{d}</small></article>)}</div>
  {dados?.erro&&<p role="alert" className="ap-alerta">{dados.erro} <button onClick={recarregar}>Tentar novamente</button></p>}
  <div className="ap-workspace"><nav className="ap-tabs" aria-label="Visões do catálogo"><button aria-current="page">Catálogo de produtos</button><a href="#/taxonomia">Matriz e taxonomia</a><a href="#/fila">Revisão manual</a><a href="#/catalogo-espelho">Ficha e divergências</a></nav>
   <form className="ap-filtros" onSubmit={e=>{e.preventDefault();setPagina(1);setQ(busca.trim());}}><div className="ap-search"><label htmlFor="ap-search">Buscar produto</label><input id="ap-search" type="search" value={busca} maxLength={100} onChange={e=>setBusca(e.target.value)} placeholder="Nome, SKU, OEM, marca ou referência"/><button type="submit" className="ap-primary">Buscar</button><button type="button" onClick={limpar}>Limpar filtros</button></div>
    <div className="ap-filter-row"><label>Modelo<select value={modelo} onChange={e=>{setModelo(e.target.value);setMotor("");}}><option value="">Todos os modelos</option>{modelos.map(m=><option key={m}>{m}</option>)}</select></label><label>Motorização<select value={motor} onChange={e=>setMotor(e.target.value)}><option value="">Todos os motores</option>{motores.map(m=><option key={m}>{m}</option>)}</select></label><label>Ano<input type="number" min={1980} max={new Date().getFullYear()+1} value={ano} onChange={e=>setAno(e.target.value)} placeholder="Ano do veículo"/></label><label>Sistema<select value={sistema} onChange={e=>setSistema(e.target.value)}><option value="">Todos os sistemas</option>{dados?.nos.map(n=><option key={n.id} value={n.id}>{n.nome}</option>)}</select></label></div>
   </form>
   <div className="ap-tablebar"><strong>{linhas.length} produto(s) no recorte</strong><span>Página {pagina} · até 100 produtos e 100 aplicações consultadas. Filtros técnicos usam somente aplicações homologadas desse recorte.</span></div>
   {!dados?<p role="status" className="ap-empty">Consultando catálogo autorizado…</p>:<div className="ap-tablewrap"><table><thead><tr><th>Produto / SKU</th><th>Marca</th><th>Aplicações homologadas no recorte</th><th>Conferência</th><th>Ficha</th></tr></thead><tbody>{linhas.map(p=>{const apps=aplicacoes.filter(a=>a.produto_id===p.id&&a.status==="aprovado");return <tr key={p.id}><td><div className="ap-produto-nome"><AtivoAprovado nome="catalogo" tamanho={36}/><span><strong>{p.nome??"Produto sem descrição"}</strong><small>{p.sku??"SKU a conferir"}</small></span></div></td><td>{p.marca??"A conferir"}</td><td>{apps.length?apps.map(a=>a.modelo).join(" / "):"Aplicação a conferir"}</td><td><span className={`ap-tag ${p.publicado?"ap-tag-ok":""}`}>{p.publicado?"Publicado":"Não publicado"}</span></td><td><a href={`#/catalogo-espelho?q=${encodeURIComponent(p.sku??p.nome??"")}`}>Conferir ↗</a></td></tr>})}</tbody></table>{!linhas.length&&<p className="ap-empty">Nenhum produto nesse recorte. Altere a busca ou limpe os filtros.</p>}</div>}
   <div className="ap-pagination"><span>Origem preservada · nenhuma gravação automática</span><button disabled={pagina===1} onClick={()=>setPagina(p=>p-1)}>Anterior</button><b>{pagina}</b><button disabled={!dados||dados.total==null||pagina*100>=dados.total} onClick={()=>setPagina(p=>p+1)}>Próxima</button></div>
  </div>
  <div className="ap-origem-regras"><article><h3>Uma peça, múltiplas aplicações</h3><p>Produto físico → aplicações documentadas → anúncios. As projeções não recebem saldo próprio.</p></article><article><h3>Conferência antes de aprovar</h3><p>A busca por texto não comprova compatibilidade, ano, motor ou OEM. A revisão mantém fonte e responsabilidade por campo.</p></article></div>
 </section>;
}
