import {useCallback,useEffect,useState,type DragEvent} from "react";
import {supabase} from "../supabase.ts";
import type {Loja} from "../lib/dados.ts";
import {BLOCOS_COMERCIAIS,NOMES_BLOCOS,intervaloPublico,moverBloco,ordemPublica,type BlocoComercial} from "../lib/layoutMobis.ts";
import "./EditorEstruturaLoja.css";

type Versao={id:string;numero:number;blocos:string[];intervalo_segundos:number;criado_em:string;criado_por:string;aprovado_em:string|null;aprovado_por:string|null};
type Publicada={versao_id:string;publicado_por:string;publicado_em:string};
type Evento={id:number;quando:string;user_id:string|null;acao:string;tabela:string;antes:Record<string,unknown>|null;depois:Record<string,unknown>|null};
const MODELOS=[
 {nome:"Comercial",blocos:["banner","montadoras","taxonomia","catalogo","empresa"]},
 {nome:"Busca primeiro",blocos:["catalogo","banner","montadoras","taxonomia","empresa"]},
 {nome:"Por veículo",blocos:["montadoras","taxonomia","banner","catalogo","empresa"]},
] as const;

/** Estrutura / Loja: monta a ordem dos blocos já existentes, sem HTML livre nem acesso ao Bling.
 * Cada salvamento cria um snapshot. Aprovar e publicar são duas ações auditadas.
 */
export function EditorEstruturaLoja({loja}:{loja:Loja}){
 const [ordem,setOrdem]=useState<BlocoComercial[]>([...BLOCOS_COMERCIAIS]);
 const [segundos,setSegundos]=useState(6);
 const [versoes,setVersoes]=useState<Versao[]>([]);
 const [publicada,setPublicada]=useState<Publicada|null>(null);
 const [eventos,setEventos]=useState<Evento[]>([]);
 const [selecionada,setSelecionada]=useState<string|null>(null);
 const [arrastando,setArrastando]=useState<number|null>(null);
 const [ocupado,setOcupado]=useState(false);
 const [carregando,setCarregando]=useState(true);
 const [erro,setErro]=useState("");
 const [info,setInfo]=useState("");
 const versao=versoes.find(v=>v.id===selecionada)||null;
 const publicadaVersao=versoes.find(v=>v.id===publicada?.versao_id);
 const temMudancas=!!versao && (ordem.join("|")!==ordemPublica(versao.blocos).join("|")||segundos!==versao.intervalo_segundos);
 const recarregar=useCallback(async()=>{
   setCarregando(true);
   const [hist,atual,audit]=await Promise.all([
    supabase.from("loja_layout_versoes").select("id,numero,blocos,intervalo_segundos,criado_em,criado_por,aprovado_em,aprovado_por").eq("loja_id",loja.id).order("numero",{ascending:false}).limit(50),
    supabase.from("loja_layout_publicado").select("versao_id,publicado_por,publicado_em").eq("loja_id",loja.id).maybeSingle(),
    supabase.from("auditoria").select("id,quando,user_id,acao,tabela,antes,depois").eq("loja_id",loja.id).in("tabela",["loja_layout_versoes","loja_layout_publicado"]).order("quando",{ascending:false}).limit(40),
   ]);
   setCarregando(false);
   if(hist.error||atual.error){
     setErro("Editor ainda indisponível: é necessário aplicar a migração de layout e validar sua permissão de lojista.");
     return;
   }
   const lista=(hist.data??[]) as Versao[];
   setVersoes(lista);setPublicada((atual.data??null) as Publicada|null);
   setEventos((audit.data??[]) as Evento[]);
   return lista;
 },[loja.id]);
 useEffect(()=>{void recarregar()},[recarregar]);
 const editar=(id:string|null)=>{
   const v=versoes.find(x=>x.id===id);
   if(v){setOrdem(ordemPublica(v.blocos));setSegundos(intervaloPublico(v.intervalo_segundos));}
   else {setOrdem([...BLOCOS_COMERCIAIS]);setSegundos(6);}
   setSelecionada(id);setErro("");setInfo("");
 };
 function mudarOrdem(de:number,para:number){
   setOrdem(a=>moverBloco(a,de,para));setInfo("");setErro("");
 }
 function largar(e:DragEvent<HTMLElement>,para:number){
   e.preventDefault();
   if(arrastando!==null)mudarOrdem(arrastando,para);
   setArrastando(null);
 }
 async function salvar(){
   if(ocupado)return;
   setOcupado(true);setErro("");setInfo("");
   const {data,error}=await supabase.rpc("layout_salvar_versao",{p_loja:loja.id,p_blocos:ordem,p_intervalo:segundos});
   setOcupado(false);
   if(error||typeof data!=="string"){setErro(error?.message||"Não foi possível salvar o rascunho.");return;}
   const lista=await recarregar();
   if(lista?.some(v=>v.id===data))setSelecionada(data);
   setInfo("Nova versão salva como rascunho. Nada mudou na loja pública.");
 }
 async function aprovar(){
   if(!versao||temMudancas||ocupado||versao.aprovado_em)return;
   if(!window.confirm("Aprovar a versão "+versao.numero+"? A ordem será registrada, mas a loja só muda após a publicação."))return;
   setOcupado(true);setErro("");setInfo("");
   const {error}=await supabase.rpc("layout_aprovar_versao",{p_loja:loja.id,p_versao:versao.id});
   setOcupado(false);
   if(error){setErro(error.message);return;}
   await recarregar();setInfo("Versão aprovada. Publique quando decidir alterar a vitrine.");
 }
 async function publicar(){
   if(!versao?.aprovado_em||temMudancas||ocupado)return;
   if(!window.confirm("Publicar a versão "+versao.numero+" na vitrine da Mobis? O histórico anterior será preservado."))return;
   setOcupado(true);setErro("");setInfo("");
   const {error}=await supabase.rpc("layout_publicar_versao",{p_loja:loja.id,p_versao:versao.id});
   setOcupado(false);
   if(error){setErro(error.message);return;}
   await recarregar();
   setInfo("Layout publicado no banco. A vitrine utilizará esta ordem após atualizar a página. Nenhum produto foi publicado.");
 }
 return <div className="layout-editor">
  <header className="layout-editor-titulo"><div><span>DASHBOARD · LOJA / ESTRUTURA E BLOCOS</span>
    <h1>Editor auditável da vitrine</h1><p>Arraste os blocos ou use as setas no celular. Cabeçalho e privacidade permanecem protegidos. Cada salvamento cria uma versão recuperável.</p>
   </div><a href={"#/loja/"+loja.slug} target="_blank" rel="noopener noreferrer">Ver vitrine ↗</a></header>
  {erro&&<p className="msg-erro" role="alert">{erro}</p>}
  {info&&<p className="msg-ok" role="status">{info}</p>}
  {carregando&&<p role="status">Conferindo versões e permissões…</p>}
  <div className="layout-editor-meta">
    <span><b>Em edição:</b> {versao?"Versão "+versao.numero:"nova versão"}</span>
    <span><b>Publicada:</b> {publicadaVersao?"Versão "+publicadaVersao.numero:"ordem padrão"}</span>
    <span><b>Estado:</b> {temMudancas?"alterações não salvas":versao?.aprovado_em?"aprovada":"rascunho"}</span>
  </div>
  <div className="layout-editor-modelos"><strong>Modelos de organização</strong>
   {MODELOS.map(m=><button key={m.nome} type="button" onClick={()=>{setOrdem(ordemPublica(m.blocos));setSelecionada(null);setInfo("Modelo carregado. Salve para criar uma versão.");}}>{m.nome}</button>)}
  </div>
  <div className="layout-editor-grade">
   <section className="layout-editor-editor" aria-label="Organize os blocos da loja">
    <div className="layout-editor-fixo"><b>01 · Cabeçalho</b><small>Logo oficial · busca · navegação · fixo</small></div>
    <ol className="layout-editor-lista">
     {ordem.map((id,i)=><li key={id} draggable={!ocupado} onDragStart={()=>setArrastando(i)} onDragEnd={()=>setArrastando(null)}
       onDragOver={e=>e.preventDefault()} onDrop={e=>largar(e,i)} aria-label={NOMES_BLOCOS[id]+" posição "+(i+1)}>
      <span className="layout-editor-arrastar" aria-hidden="true">⠿</span>
      <div><b>{NOMES_BLOCOS[id]}</b><small>{id==="banner"?"Produtos publicados · carrossel automático":"Nó Conecta.IA · bloco pronto"}</small></div>
      <span className="layout-editor-setas">
       <button type="button" aria-label={"Subir "+NOMES_BLOCOS[id]} disabled={i===0||ocupado} onClick={()=>mudarOrdem(i,i-1)}>↑</button>
       <button type="button" aria-label={"Descer "+NOMES_BLOCOS[id]} disabled={i===ordem.length-1||ocupado} onClick={()=>mudarOrdem(i,i+1)}>↓</button>
      </span>
     </li>)}
    </ol>
    <div className="layout-editor-fixo"><b>07 · Rodapé e privacidade</b><small>Políticas aprovadas · fixo e protegido</small></div>
    <p className="layout-editor-nota">Atendimento e lista de consulta permanecem disponíveis em qualquer composição. O editor altera apenas a apresentação, nunca preço, estoque ou NF.</p>
   </section>
   <aside className="layout-editor-revisao">
    <h2>Carrossel Flash</h2>
    <label>Intervalo entre banners: <strong>{segundos} segundos</strong>
      <input type="range" min={4} max={15} value={segundos} onChange={e=>setSegundos(intervaloPublico(Number(e.target.value)))} />
    </label>
    <p>Até 24 campanhas ativas por loja, cada uma vinculada ao SKU e à imagem publicável. A ordem dos slides continua configurável no editor de banners.</p>
    <a href="#/banners">Gerenciar campanhas Flash →</a>
    <h2>Antes de publicar</h2>
    <ul><li>Conferir a ordem visual no celular</li><li>Aprovar esta versão como lojista</li><li>Acionar a publicação separadamente</li><li>Registrar autor, data e alterações</li></ul>
    <div className="layout-editor-acoes">
      <button type="button" disabled={ocupado||carregando} onClick={()=>void salvar()}>{ocupado?"Processando…":"Salvar nova versão"}</button>
      <button type="button" disabled={!versao||temMudancas||!!versao.aprovado_em||ocupado} onClick={()=>void aprovar()}>Aprovar versão</button>
      <button type="button" disabled={!versao?.aprovado_em||temMudancas||ocupado||publicada?.versao_id===versao?.id} onClick={()=>void publicar()}>Publicar versão aprovada</button>
    </div>
   </aside>
  </div>
  <section className="layout-editor-historico" aria-label="Histórico auditável de versões">
   <h2>Histórico e recuperação</h2>
   {!versoes.length&&<p>Nenhuma versão criada. A vitrine usa a ordem padrão.</p>}
   {versoes.map(v=><div key={v.id} className="layout-editor-versao">
    <div><strong>Versão {v.numero}</strong><small>Criada em {new Date(v.criado_em).toLocaleString("pt-BR")} · autor {v.criado_por.slice(0,8)}…</small>
      <small>Ordem: {ordemPublica(v.blocos).map(id=>NOMES_BLOCOS[id]).join(" → ")}</small>
      <small>{v.aprovado_em?"Aprovada por "+(v.aprovado_por?.slice(0,8)??"lojista")+"… em "+new Date(v.aprovado_em).toLocaleString("pt-BR"):"Aguardando aprovação"} · {publicada?.versao_id===v.id?"PUBLICADA": "não publicada"}</small>
    </div>
    <button type="button" onClick={()=>editar(v.id)}>Inspecionar / carregar</button>
   </div>)}
   <p className="layout-editor-nota">Reverter significa publicar novamente uma versão antiga já aprovada. O registro de publicação anterior nunca é apagado.</p>
   <h3>Registro de ações (auditoria imutável)</h3>
   <p className="layout-editor-nota">As ações são gravadas automaticamente no banco com identidade, data, valores anteriores e novos.</p>
   {eventos.length===0&&<p>Nenhum evento de alteração de layout registrado nesta loja.</p>}
   <ol className="layout-editor-eventos">{eventos.map(ev=><li key={ev.id}>
     <strong>{ev.tabela==="loja_layout_publicado"?"Publicação de layout":ev.acao==="insert"?"Nova versão salva":"Versão aprovada"}</strong>
     <small>{new Date(ev.quando).toLocaleString("pt-BR")} · usuário {ev.user_id??"processo autorizado"}</small>
     {ev.tabela==="loja_layout_versoes"&&Array.isArray(ev.depois?.blocos)&&<small>Ordem: {(ev.depois.blocos as string[]).join(" → ")}</small>}
     {ev.tabela==="loja_layout_publicado"&&<small>Versão: {String(ev.antes?.versao_id??"nenhuma").slice(0,8)} → {String(ev.depois?.versao_id??"nenhuma").slice(0,8)}</small>}
   </li>)}</ol>
  </section>
 </div>;
}
