import {useEffect,useMemo,useState} from "react";
import {supabase} from "../supabase.ts";
import {auditarAplicacoesLegadas,type AplicacaoLegada,type ModeloRelacional} from "../../../supabase/functions/_shared/nano_lifecycle/reconciliacao_veicular.ts";

type Produto={id:string;sku:string|null;nome:string|null;situacao:string|null;publicado:boolean};
type Resultado=ReturnType<typeof auditarAplicacoesLegadas>;
type Dados={auditoria:Resultado;aplicacoes:AplicacaoLegada[];produtos:Produto[];consultadoEm:string};
type Filtro="todos"|"vinculadas"|"candidatos"|"conflitos"|"sem_no";
const LIMITE=1000;
const ROTULOS:Record<string,string>={vinculada:"Vínculo existente",candidato_unico:"Candidato nominal",ambiguo:"Identidade ambígua",sem_no:"Sem nó exato",conflito_vinculo:"Vínculo divergente",fonte_declara_homologacao_pendente:"Fonte contradiz aprovação",fonte_ou_data_ausente:"Fonte/data ausente",motor_ausente:"Motor ausente",motor_composto_a_revisar:"Motor composto a revisar",ano_inicial_ausente_ou_invalido:"Ano inicial a conferir",ano_final_ausente_ou_invalido:"Ano final a conferir",periodo_invertido:"Período invertido",oem_ausente:"OEM ausente",evidencia_tecnica_estruturada_a_verificar:"Evidência técnica a verificar",status_nao_aprovado:"Status não aprovado"};
/** Não aceita resultados truncados como se fossem o universo auditado. */
function completo<T>(r:{data:T[]|null;count:number|null;error:unknown}):T[]{
 if(r.error||r.data==null||r.count==null||r.data.length!==r.count||r.count>LIMITE)throw Error("Leitura indisponível ou excede o limite do recorte.");
 return r.data;
}
export function AuditoriaVeicular({lojaId}:{lojaId:string}){
 const [dados,setDados]=useState<Dados|null>(null),[erro,setErro]=useState(false),[ciclo,setCiclo]=useState(0);
 const [filtro,setFiltro]=useState<Filtro>("todos"),[busca,setBusca]=useState(""),[visiveis,setVisiveis]=useState(25);
 useEffect(()=>{let vivo=true;setDados(null);setErro(false);
  void(async()=>{try{
   // Sessão autenticada e RLS existentes; nenhum service role no navegador.
   const [ar,mo,md]=await Promise.all([
    supabase.from("produto_aplicacoes").select("id,loja_id,produto_id,modelo,modelo_id,motorizacao,ano_inicial,ano_final,codigo_oem,fonte,coletado_em,status",{count:"exact"}).eq("loja_id",lojaId).eq("status","aprovado").order("id").limit(LIMITE),
    supabase.from("montadoras").select("id,nome",{count:"exact"}).order("id").limit(LIMITE),
    supabase.from("modelos").select("id,nome,montadora_id",{count:"exact"}).order("id").limit(LIMITE),
   ]);
   const apps=completo(ar) as AplicacaoLegada[];
   const fabricantes=new Map(completo(mo).map(m=>[m.id,m.nome]));
   const modelos:ModeloRelacional[]=completo(md).map(m=>({id:m.id,nome:m.nome,montadora_id:m.montadora_id,montadora:fabricantes.get(m.montadora_id)??""}));
   if(modelos.some(m=>!m.montadora))throw Error("Matriz incompleta");
   if(apps.some(a=>a.loja_id!==lojaId))throw Error("Escopo divergente");
   const ids=[...new Set(apps.map(a=>a.produto_id))],produtos:Produto[]=[];
   for(let i=0;i<ids.length;i+=75){
    if(!vivo)return;
    const lote=ids.slice(i,i+75);
    const r=await supabase.from("produtos").select("id,sku,nome,situacao,publicado").eq("loja_id",lojaId).in("id",lote);
    if(r.error||!r.data||r.data.length!==lote.length||r.data.some(p=>!lote.includes(p.id)))throw Error("Produtos não reconciliados");
    produtos.push(...r.data as Produto[]);
   }
   if(new Set(produtos.map(p=>p.id)).size!==ids.length)throw Error("Identidades de produto divergentes");
   const ativos=produtos.filter(p=>p.situacao==="A"&&p.publicado),conjunto=new Set(ativos.map(p=>p.id));
   const recorte=apps.filter(a=>conjunto.has(a.produto_id));
   const auditoria=auditarAplicacoesLegadas(lojaId,recorte,modelos);
   if(vivo)setDados({auditoria,aplicacoes:recorte,produtos:ativos,consultadoEm:new Date().toISOString()});
  }catch{if(vivo)setErro(true)}})();
  return()=>{vivo=false};
 },[lojaId,ciclo]);
 const linhas=useMemo(()=>{
  if(!dados)return [];
  const a=new Map(dados.aplicacoes.map(a=>[a.id,a])),p=new Map(dados.produtos.map(p=>[p.id,p])),q=busca.trim().toLowerCase();
  return dados.auditoria.resultados.map(r=>({r,a:a.get(r.aplicacao_id)!,p:p.get(r.produto_id)!})).filter(({r,a,p})=>{
   const conflito=r.identidade==="conflito_vinculo"||r.identidade==="ambiguo"||r.pendencias.includes("fonte_declara_homologacao_pendente");
   if(filtro==="vinculadas"&&r.identidade!=="vinculada"||filtro==="candidatos"&&r.identidade!=="candidato_unico"||filtro==="conflitos"&&!conflito||filtro==="sem_no"&&r.identidade!=="sem_no")return false;
   return !q||[p.sku,p.nome,a.modelo,a.motorizacao,a.codigo_oem].some(v=>v?.toLowerCase().includes(q));
  }).sort((x,y)=>Number(y.r.pendencias.includes("fonte_declara_homologacao_pendente"))-Number(x.r.pendencias.includes("fonte_declara_homologacao_pendente"))||(x.p.sku??"").localeCompare(y.p.sku??"","pt-BR"));
 },[dados,busca,filtro]);
 return <section className="tx-auditoria" aria-label="Nano Quality Gate — Auditoria veicular">
  <header><h2>Nano Quality Gate · Reconciliação veicular</h2><p className="suave">Aplicações com status aprovado de produtos ativos e publicados. Vínculo existente não equivale a homologação técnica.</p></header>
  {erro?<p role="alert">Auditoria indisponível ou recorte acima do limite de {LIMITE} registros por consulta. Nenhum total presumido. <button className="sec" onClick={()=>setCiclo(c=>c+1)}>Tentar novamente</button></p>:!dados?<p role="status">Consultando matriz autorizada…</p>:<>
   <div className="tx-inds">{[["Aplicações auditadas",dados.auditoria.total],["Produtos físicos",dados.produtos.length],["Vínculos existentes",dados.auditoria.vinculadas],["Candidatos nominais",dados.auditoria.candidatosUnicos],["Fontes contraditórias",dados.auditoria.conflitosFonte]].map(([r,n])=><div className="tx-ind" key={r}><span className="tx-ind-valor mono">{n}</span><span className="tx-ind-rot">{r}</span></div>)}</div>
   <p className="suave">Consulta realizada em {new Date(dados.consultadoEm).toLocaleString("pt-BR")}. Sem aprovação automática. Os grupos de pendências podem se sobrepor.</p>
   <div className="tx-filtros"><label>Estado <select value={filtro} onChange={e=>{setFiltro(e.target.value as Filtro);setVisiveis(25)}}><option value="todos">Todos</option><option value="vinculadas">Vínculos existentes</option><option value="candidatos">Candidatos</option><option value="conflitos">Conflitos</option><option value="sem_no">Sem nó exato</option></select></label><input type="search" aria-label="Buscar na auditoria veicular" placeholder="SKU, modelo, motor ou OEM" value={busca} onChange={e=>{setBusca(e.target.value);setVisiveis(25)}}/><button className="sec" onClick={()=>setCiclo(c=>c+1)}>Atualizar leitura</button></div>
   <p className="suave">{linhas.length} registro(s) no filtro.</p>
   <div className="tx-auditoria-lista">{linhas.slice(0,visiveis).map(({a,r,p})=><details key={a.id} className="tx-auditoria-item"><summary><strong>{p.sku??"SKU a conferir"} · {a.modelo}</strong><span>{ROTULOS[r.identidade]??r.identidade}{r.pendencias.includes("fonte_declara_homologacao_pendente")?" · Conflito de fonte":""}</span></summary><p>{p.nome??"Produto sem nome"}</p><dl className="tx-auditoria-dados"><dt>Motor</dt><dd>{a.motorizacao??"A conferir"}</dd><dt>Período registrado</dt><dd>{a.ano_inicial??"?"} – {a.ano_final??"?"}</dd><dt>OEM registrado</dt><dd>{a.codigo_oem??"A conferir"}</dd><dt>Identidade candidata</dt><dd>{r.candidato?r.candidato.montadora+" "+r.candidato.modelo:"—"}</dd><dt>Fonte legada</dt><dd>{a.fonte??"Não informada"}</dd></dl><ul>{r.pendencias.map(x=><li key={x}>{ROTULOS[x]??x}</li>)}</ul><a href={"#/catalogo-espelho?q="+encodeURIComponent(p.sku??p.nome??"")}>Conferir ficha do SKU →</a></details>)}</div>
   {!linhas.length&&<p role="status">Nenhum registro neste filtro.</p>}
   {linhas.length>visiveis&&<button className="sec" onClick={()=>setVisiveis(n=>n+25)}>Mostrar mais</button>}
  </>}
 </section>;
}
