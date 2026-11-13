import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Loja } from "../lib/dados.ts";
import type { Item } from "../lib/comandosNL.ts";
import { useWorkspaceDados } from "../lib/workspaceDados.ts";
import { supabase } from "../supabase.ts";
import { Assistente } from "./Assistente.tsx";
import { OlhoNano } from "../componentes/OlhoNano.tsx";
import { AtivoAprovado } from "../componentes/AtivoAprovado.tsx";
import { Icone } from "../componentes/Icone.tsx";

const ABAS=[['graficos','grafico','Gráficos'],['tabela','catalogo','Tabelas'],['imagens','imagens','Imagens'],['web','web','Web'],['contexto','contexto','Contexto']] as const;
type Aba=typeof ABAS[number][0];
type Imagem={id:string;url:string;tipo:string;origem:string|null};
export function NanoWorkspace({loja,menu,aoNavegar}:{loja:Loja;menu:[string,string][];aoNavegar:(rota:string)=>void}){
 const [aba,setAba]=useState<Aba>('graficos'),[ajustes,setAjustes]=useState(false),[amplo,setAmplo]=useState(false),[pane,setPane]=useState<'chat'|'trabalho'>('chat');
 const [largura,setLargura]=useState(350),[altura,setAltura]=useState(640);
 const [fotos,setFotos]=useState<Imagem[]|null>(null),[erroFotos,setErroFotos]=useState(false);
 const raiz=useRef<HTMLElement>(null),arrasto=useRef<{x:number;largura:number}|null>(null);
 const {dados,recarregar}=useWorkspaceDados(loja.id);
 function navegar(rota:string){
  if(['/catalogo','/catalogo-espelho','/catalogo-aplicacao'].includes(rota)){abrir('tabela');return;}
  if(rota==='/imagens'){abrir('imagens');return;}
  if(rota==='/indicadores'){abrir('graficos');return;}
  aoNavegar(rota);
 }
 const chave='nano:workspace:dimensoes:'+loja.id;
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(chave)??'null');if(v){setLargura(Math.max(280,Math.min(520,Number(v.largura)||350)));setAltura(Math.max(480,Math.min(820,Number(v.altura)||640)));}}catch{}},[chave]);
 function dimensionar(w:number,h:number){setLargura(w);setAltura(h);try{localStorage.setItem(chave,JSON.stringify({largura:w,altura:h}));}catch{}}
 useEffect(()=>{if(aba!=='imagens')return;let ativo=true;setFotos(null);setErroFotos(false);
  void supabase.from('produto_imagens').select('id,url,tipo,origem').eq('loja_id',loja.id).eq('aprovada',true).is('removida_em',null).limit(24).then(r=>{if(ativo){setFotos(r.error?[]:r.data??[]);setErroFotos(!!r.error);}});
  return()=>{ativo=false;};
 },[aba,loja.id]);
 const grupos=new Map<string,number>();
 for(const p of dados?.produtos??[]){const nome=dados?.nos.find(n=>n.id===p.taxonomia_no_id)?.nome??'Sem classificação registrada';grupos.set(nome,(grupos.get(nome)??0)+1);}
 const barras=[...grupos].sort((a,b)=>b[1]-a[1]),max=Math.max(1,...barras.map(x=>x[1]));
 function abrir(a:Aba){setAba(a);setPane('trabalho');}
 function mover(e:PointerEvent<HTMLDivElement>){if(arrasto.current){const w=Math.max(280,Math.min(520,Math.round(arrasto.current.largura+arrasto.current.x-e.clientX)));dimensionar(w,altura);}}
 return <section ref={raiz} className="ap-nano-workspace" data-nano-layout="aprovado-v2">
  <OlhoNano area={raiz} ancora=".ap-heading"/>
  <header className="ap-heading"><div><span className="ap-eyebrow">CONECTA.IA · NANO.IA · {loja.nome}</span><h1>Estúdio do Nano</h1><p>Conversa ajustável. Ferramentas em uma Torre. Um contexto por tarefa.</p></div><div className="ap-heading-acoes"><button aria-expanded={ajustes} aria-controls="ap-chat-ajustes" onClick={()=>setAjustes(!ajustes)}><Icone nome="ajustes" tamanho={17}/> Ajustar chat</button><a href="#/catalogo-aplicacao">Catálogo ↗</a></div></header>
  {ajustes&&<div className="ap-chat-ajustes" id="ap-chat-ajustes"><label>Largura da conversa <output>{largura}px</output><input aria-label="Largura da conversa" type="range" min={280} max={520} step={10} value={largura} onChange={e=>dimensionar(Number(e.target.value),altura)}/></label><label>Altura da conversa <output>{altura}px</output><input aria-label="Altura da conversa" type="range" min={480} max={820} step={10} value={altura} onChange={e=>dimensionar(largura,Number(e.target.value))}/></label><button onClick={()=>dimensionar(320,640)}>Compacto</button><button onClick={()=>dimensionar(390,640)}>Smartphone</button><button onClick={()=>dimensionar(480,740)}>Amplo</button></div>}
  <nav className="ap-mobile-panes" aria-label="Áreas do Estúdio"><button aria-pressed={pane==='chat'} onClick={()=>setPane('chat')}>Conversa</button><button aria-pressed={pane==='trabalho'} onClick={()=>setPane('trabalho')}>Área de trabalho</button></nav>
  <div className={`ap-studio-layout ${amplo?'ap-chat-amplo':''}`} data-pane={pane} style={{'--chat-width':largura+'px','--chat-height':altura+'px'} as CSSProperties}>
   <section className="ap-work-panel"><header className="ap-work-header"><strong><AtivoAprovado nome="web" tamanho={27}/> Área de trabalho</strong><small>RESULTADOS CONFERÍVEIS</small></header><nav className="ap-work-tabs" aria-label="Artefatos do Nano">{ABAS.map(([id,ic,t])=><button key={id} aria-pressed={aba===id} onClick={()=>abrir(id)}><AtivoAprovado nome={ic} tamanho={24}/>{t}</button>)}</nav>
    <div className="ap-work-content" aria-live="polite">
     {dados?.erro&&<p role="alert" className="ap-alerta">{dados.erro} <button onClick={recarregar}>Tentar novamente</button></p>}
     {aba==='graficos'&&<><span className="ap-eyebrow">ARTEFATO / GRÁFICO</span><h2>O catálogo em perspectiva.</h2><p>Distribuição por classificação registrada no espelho. Este recorte contém até 100 produtos e não representa vendas ou saldo.</p>{!dados?<p role="status">Consultando dados autorizados…</p>:barras.length?<div className="ap-chart" aria-label="Produtos por classificação">{barras.map(([n,v])=><div key={n}><span>{n}</span><div><i style={{width:100*v/max+'%'}}/></div><b>{v}</b></div>)}</div>:<p className="ap-empty">Nenhum produto disponível nesse recorte.</p>}<a href="#/catalogo-aplicacao">Conferir produtos e aplicações →</a></>}
     {aba==='tabela'&&<><span className="ap-eyebrow">ARTEFATO / TABELA</span><h2>Produtos do espelho.</h2><p>Até 100 registros da loja autenticada. Confira a ficha antes de propor alterações.</p><div className="ap-tablewrap"><table><thead><tr><th>SKU</th><th>Produto</th><th>Marca</th><th>Ficha</th></tr></thead><tbody>{dados?.produtos.map(p=><tr key={p.id}><td>{p.sku??'—'}</td><td>{p.nome??'A conferir'}</td><td>{p.marca??'A conferir'}</td><td><a href={`#/catalogo-espelho?q=${encodeURIComponent(p.sku??p.nome??'')}`}>Abrir ↗</a></td></tr>)}</tbody></table></div>{dados&&!dados.produtos.length&&<p className="ap-empty">Nenhum produto carregado.</p>}</>}
     {aba==='imagens'&&<><span className="ap-eyebrow">ARTEFATO / IMAGENS</span><h2>Evidências visuais.</h2><p>Somente imagens aprovadas desta loja. A origem permanece identificada.</p>{erroFotos?<p role="alert">Não foi possível carregar as imagens autorizadas.</p>:fotos===null?<p role="status">Consultando galeria…</p>:fotos.length?<div className="ap-imagens">{fotos.map(f=><figure key={f.id}><img src={f.url} alt={`Imagem aprovada · ${f.tipo}`} referrerPolicy="no-referrer"/><figcaption>{f.tipo==='gerada_ia'?'Sintética':f.tipo==='real'?'Foto real':'Ilustrativa'} · {f.origem??'Origem a conferir'}</figcaption></figure>)}</div>:<p className="ap-empty">Nenhuma imagem aprovada disponível.</p>}<a href="#/imagens">Abrir revisão de imagens →</a></>}
     {aba==='web'&&<><span className="ap-eyebrow">AMBIENTE / WEB</span><h2>Loja do cliente.</h2><p>Prévia da rota pública real. Não é uma sessão de browser remoto nem acesso ao Bling.</p><a href={`#/loja/${encodeURIComponent(loja.slug)}`} target="_blank" rel="noopener noreferrer">Abrir loja em outra aba ↗</a><iframe className="ap-web-preview" title="Prévia pública da loja" src={`./#/loja/${encodeURIComponent(loja.slug)}`} loading="lazy"/></>}
     {aba==='contexto'&&<><span className="ap-eyebrow">AMBIENTE / CONTEXTO E FERRAMENTAS</span><h2>Trabalho com contexto.</h2><dl className="ap-contexto"><div><dt>Loja autenticada</dt><dd>{loja.nome}</dd></div><div><dt>Origem</dt><dd>Espelho do ERP Bling</dd></div><div><dt>Ambiente</dt><dd>{loja.ambiente}</dd></div><div><dt>Revisão humana</dt><dd>{dados?.fila??'—'} propostas pendentes</dd></div></dl><div className="ap-contexto-acoes"><a href="#/ferramentas">Indexar e enriquecer ↗</a><a href="#/fila">Revisar propostas ↗</a>{menu.some(x=>x[0]==='/parear')&&<a href="#/parear">Pareamento do agente ↗</a>}<a href="#/integracoes">Configuração dos provedores ↗</a></div><p>O chat mantém as configurações, consentimentos e ferramentas disponíveis no servidor. A Torre não habilita operações nem cria uma sessão remota por conta própria.</p></>}
    </div>
   </section>
   <div className="ap-chat-splitter" role="separator" tabIndex={0} aria-label="Redimensionar largura da conversa" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={520} aria-valuenow={largura} onPointerDown={e=>{arrasto.current={x:e.clientX,largura};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={mover} onPointerUp={e=>{arrasto.current=null;e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{arrasto.current=null;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();dimensionar(Math.max(280,Math.min(520,largura+(e.key==='ArrowLeft'?10:-10))),altura);}}}/>
   <section className="ap-chat-panel"><div className="ap-chat-caption"><span>CONVERSA · NANO.IA</span><button onClick={()=>setAmplo(!amplo)} aria-label={amplo?'Voltar à área dividida':'Ampliar conversa'}><Icone nome={amplo?'recolher':'monitor'} tamanho={18}/></button></div><Assistente key={loja.id} loja={loja} menu={menu as Item[]} aoNavegar={navegar}/></section>
   <nav className="ap-tower" aria-label="Torre de ferramentas"><span>Torre</span>{ABAS.map(([id,ic,t])=><button key={id} aria-label={`Abrir ${t}`} aria-pressed={aba===id} onClick={()=>abrir(id)}><AtivoAprovado nome={ic} tamanho={30}/><small>{t}</small></button>)}<button className="ap-tower-end" onClick={()=>setAjustes(!ajustes)} aria-label="Ajustar dimensões do chat"><Icone nome="ajustes" tamanho={20}/></button></nav>
  </div>
  <footer className="ap-studio-ledger"><span>Fontes e evidências identificadas · loja autenticada</span><span>Estoque e dados fiscais preservados</span></footer>
 </section>;
}
