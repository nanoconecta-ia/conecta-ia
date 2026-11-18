import {useCallback,useEffect,useState,type CSSProperties} from "react";
import {supabase} from "../supabase.ts";
import type {Loja} from "../lib/dados.ts";
import logoMobis from "../assets/marcas/mobis-ma-horizontal.svg";
import {MODELOS_PALETA_MOBIS,PALETA_MOBIS_PADRAO,validarPaletaMobis,variaveisPaletaMobis,
 type PaletaMobis} from "../lib/paletaMobis.ts";
import "./AparenciaMobis.css";

type Versao=PaletaMobis & {id:string;numero:number;criado_em:string;criado_por:string;aprovado_em:string|null;aprovado_por:string|null};
type Publicacao={versao_id:string;publicado_em:string;publicado_por:string};
type Evento={id:number;quando:string;acao:string;tabela:string;user_id:string|null;antes:Record<string,unknown>|null;depois:Record<string,unknown>|null};
const CAMPOS=[
 ["cor_fundo","Fundo geral"],["cor_superficie","Cartões e seções"],["cor_texto","Títulos e textos"],
 ["cor_botao","Botões comerciais"],["cor_acento","Detalhes da marca"],
] as const;
function corDaVersao(v:Versao):PaletaMobis{
 return {cor_fundo:v.cor_fundo,cor_superficie:v.cor_superficie,
   cor_texto:v.cor_texto,cor_botao:v.cor_botao,cor_acento:v.cor_acento};
}

/** Dashboard > Loja > Cores: propostas versionadas. Salvar nunca publica.
 * Imagens, logotipo, tipografia e dados do Bling estão FORA deste editor.
 */
export function AparenciaMobis({loja}:{loja:Loja}){
 const [cores,setCores]=useState<PaletaMobis>({...PALETA_MOBIS_PADRAO});
 const [versoes,setVersoes]=useState<Versao[]>([]);
 const [publicacao,setPublicacao]=useState<Publicacao|null>(null);
 const [historico,setHistorico]=useState<Evento[]>([]);
 const [selecionada,setSelecionada]=useState<string|null>(null);
 const [ocupado,setOcupado]=useState(false);
 const [carregando,setCarregando]=useState(true);
 const [erro,setErro]=useState("");
 const [info,setInfo]=useState("");
 const versao=versoes.find(v=>v.id===selecionada)||null;
 const atual=versoes.find(v=>v.id===publicacao?.versao_id)||null;
 const valida=validarPaletaMobis(cores);
 const alterada=!!versao&&CAMPOS.some(([k])=>versao[k]!==cores[k]);
 const carregar=useCallback(async()=>{
   setCarregando(true);
   const [vers,ativa,audit]=await Promise.all([
     supabase.from("loja_paleta_versoes").select("*").eq("loja_id",loja.id).order("numero",{ascending:false}).limit(50),
     supabase.from("loja_paleta_publicada").select("versao_id,publicado_em,publicado_por").eq("loja_id",loja.id).maybeSingle(),
     supabase.from("auditoria").select("id,quando,acao,tabela,user_id,antes,depois").eq("loja_id",loja.id)
       .in("tabela",["loja_paleta_versoes","loja_paleta_publicada"]).order("quando",{ascending:false}).limit(40)
   ]);
   setCarregando(false);
   if(vers.error||ativa.error){setErro("O editor de cores ainda não está disponível para esta loja. Verifique a migração e as permissões.");return null;}
   const lista=(vers.data??[]) as Versao[];
   setVersoes(lista);setPublicacao((ativa.data??null) as Publicacao|null);
   setHistorico((audit.data??[]) as Evento[]);
   return {lista,ativa:(ativa.data??null) as Publicacao|null};
 },[loja.id]);
 useEffect(()=>{
   let montado=true;
   void carregar().then(resultado=>{
     if(!montado||!resultado)return;
     const base=resultado.lista.find(v=>v.id===resultado.ativa?.versao_id)??resultado.lista[0];
     if(base){setCores(corDaVersao(base));setSelecionada(base.id);}
   });
   return()=>{montado=false};
 },[carregar]);
 const escolher=(v:Versao)=>{
   setCores(corDaVersao(v));setSelecionada(v.id);setInfo("");setErro("");
 };
 const mudarCor=(campo:keyof PaletaMobis,valor:string)=>{
   setCores(c=>({...c,[campo]:valor.toLowerCase().slice(0,7)}));
   setSelecionada(null);setInfo("");setErro("");
 };
 const escolherModelo=(id:string)=>{
   const modelo=MODELOS_PALETA_MOBIS.find(m=>m.id===id);
   if(!modelo)return;
   setCores({...modelo.cores});setSelecionada(null);
   setInfo("Modelo carregado somente na prévia. Salve para criar um rascunho auditável.");setErro("");
 };
 async function salvar(){
   if(ocupado||!valida.ok)return;
   setOcupado(true);setErro("");setInfo("");
   const {data,error}=await supabase.rpc("paleta_salvar_versao",{
      p_loja:loja.id,p_fundo:cores.cor_fundo,p_superficie:cores.cor_superficie,
      p_texto:cores.cor_texto,p_botao:cores.cor_botao,p_acento:cores.cor_acento});
   setOcupado(false);
   if(error||typeof data!=="string"){setErro(error?.message??"Não foi possível salvar a versão.");return;}
   await carregar();setSelecionada(data);
   setInfo("Rascunho de cores salvo com auditoria. O site permanece inalterado.");
 }
 async function aprovar(){
   if(ocupado||!versao||alterada||versao.aprovado_em)return;
   if(!window.confirm("Aprovar a versão "+versao.numero+" de cores? Ela ainda NÃO será publicada."))return;
   setOcupado(true);setErro("");setInfo("");
   const {error}=await supabase.rpc("paleta_aprovar_versao",{p_loja:loja.id,p_versao:versao.id});
   setOcupado(false);
   if(error){setErro(error.message);return;}
   await carregar();setInfo("Versão aprovada pelo lojista. A publicação continua separada.");
 }
 async function publicar(){
   if(ocupado||!versao?.aprovado_em||alterada)return;
   if(!window.confirm("Publicar a versão "+versao.numero+" de cores na vitrine Mobis? Isso não muda produtos nem o Bling."))return;
   setOcupado(true);setErro("");setInfo("");
   const {error}=await supabase.rpc("paleta_publicar_versao",{p_loja:loja.id,p_versao:versao.id});
   setOcupado(false);
   if(error){setErro(error.message);return;}
   await carregar();setInfo("Paleta publicada e auditada. Atualize a vitrine para visualizar a nova aparência.");
 }
 const paletaPrev=valida.ok?cores:PALETA_MOBIS_PADRAO;
 const css=variaveisPaletaMobis(paletaPrev) as CSSProperties;
 return <div className="mobis-cores-dashboard">
  <header className="mobis-cores-titulo">
   <div><span>DASHBOARD · LOJA / CORES E IDENTIDADE</span><h1>Painel de cores da Mobis</h1>
    <p>Edite a vitrine por blocos, usando fundo claro, grafite e acentos discretos. Nenhuma mudança atinge o logotipo, a tipografia, os mascotes ou o Bling.</p>
   </div>
   <a href={"#/loja/"+loja.slug} target="_blank" rel="noopener noreferrer">Ver vitrine ↗</a>
  </header>
  {erro&&<p role="alert" className="msg-erro">{erro}</p>}
  {info&&<p role="status" className="msg-ok">{info}</p>}
  {carregando&&<p role="status">Conferindo paletas e permissões…</p>}
  <div className="mobis-cores-status">
   <span><strong>Prévia:</strong> {versao?"Versão "+versao.numero:"nova paleta"}</span>
   <span><strong>Publicada:</strong> {atual?"Versão "+atual.numero:"identidade atual preservada"}</span>
   <span><strong>Estado:</strong> {alterada?"edição não salva":versao?.aprovado_em?"aprovada":"rascunho"}</span>
  </div>
  <section className="mobis-cores-presets" aria-label="Combinações de cores">
   <h2>Combinações prontas</h2>
   <div>{MODELOS_PALETA_MOBIS.map(modelo=><button type="button" key={modelo.id}
     onClick={()=>escolherModelo(modelo.id)}>
     <span className="mobis-cores-mini" aria-hidden="true">
      {([modelo.cores.cor_fundo,modelo.cores.cor_superficie,modelo.cores.cor_botao,modelo.cores.cor_acento] as string[])
       .map((cor,i)=><i key={i} style={{background:cor}}/>)}
     </span><strong>{modelo.nome}</strong><small>{modelo.descricao}</small>
    </button>)}</div>
  </section>
  <div className="mobis-cores-grade">
   <section className="mobis-cores-edicao" aria-label="Editar as cores">
    <h2>Cores dos blocos</h2>
    {CAMPOS.map(([campo,rotulo])=><label key={campo} className="mobis-cores-campo">
      <span>{rotulo}</span><span><input type="color" aria-label={"Selecionar "+rotulo}
        value={/^#[0-9a-f]{6}$/.test(cores[campo])?cores[campo]:"#ffffff"}
        onChange={e=>mudarCor(campo,e.target.value)}/>
      <input type="text" aria-label={"Código hexadecimal de "+rotulo} spellCheck={false}
        maxLength={7} value={cores[campo]} onChange={e=>mudarCor(campo,e.target.value)}/></span>
     </label>)}
    {!valida.ok&&<p className="mobis-cores-contraste" role="alert">{valida.erro}</p>}
    {valida.ok&&<p className="mobis-cores-ok">Contraste mínimo AA verificado. A publicação também será validada pelo servidor.</p>}
    <div className="mobis-cores-acoes">
      <button type="button" onClick={()=>void salvar()} disabled={ocupado||carregando||!valida.ok}>Salvar nova versão</button>
      <button type="button" onClick={()=>void aprovar()} disabled={ocupado||!versao||alterada||!!versao.aprovado_em}>Aprovar versão</button>
      <button type="button" onClick={()=>void publicar()} disabled={ocupado||!versao?.aprovado_em||alterada||publicacao?.versao_id===versao?.id}>Publicar versão aprovada</button>
    </div>
    <p className="mobis-cores-ressalva">Salvar não altera a loja. Aprovar não publica. Só a última ação publica cores; o histórico anterior é preservado.</p>
   </section>
   <section className="mobis-cores-previsualizar" aria-label="Pré-visualização local da paleta">
    <h2>Prévia dos blocos</h2>
    <div className="mobis-cores-amostra" style={css}>
     <div className="mobis-cores-amostra-cab"><img src={logoMobis} alt="Logo oficial da Mobis Autopeças"/>
       <span>Buscar peça</span></div>
     <div className="mobis-cores-amostra-hero">
       <small>CARROSSEL FLASH · CAMPANHAS APROVADAS</small>
       <h3>Peças para picapes e utilitários diesel</h3>
       <p>O banner de cada produto abre a sua própria página.</p>
       <span>Ver produto →</span>
     </div>
     <div className="mobis-cores-amostra-cards">
      <div><strong>Montadoras</strong><small>Escolha por modelo</small></div>
      <div><strong>Taxonomia</strong><small>Motor · suspensão · transmissão</small></div>
      <div><strong>Catálogo</strong><small>SKU único · aplicações aprovadas</small></div>
     </div>
     <div className="mobis-cores-amostra-rodape">Privacidade · Informação institucional</div>
    </div>
    <p>Prévia ilustrativa dos componentes. Não representa produtos ou ofertas publicadas. O logotipo é o arquivo oficial do projeto.</p>
   </section>
  </div>
  <section className="mobis-cores-historico">
   <h2>Histórico auditável</h2>
   {!versoes.length&&<p>Nenhuma versão salva. A loja permanece com as cores existentes.</p>}
   {versoes.map(v=><div key={v.id} className="mobis-cores-versao">
    <div><strong>Versão {v.numero}{publicacao?.versao_id===v.id?" · PUBLICADA":""}</strong>
     <small>Criada em {new Date(v.criado_em).toLocaleString("pt-BR")} · autor {v.criado_por.slice(0,8)}…</small>
     <small>{v.aprovado_em?"Aprovada em "+new Date(v.aprovado_em).toLocaleString("pt-BR"):"Aguardando aprovação"} · {CAMPOS.map(([k])=>v[k]).join(" / ")}</small>
    </div><button type="button" onClick={()=>escolher(v)}>Inspecionar / recuperar</button>
   </div>)}
   <h3>Eventos de auditoria</h3>
   {historico.length===0&&<p>Nenhum evento de cor registrado.</p>}
   {historico.map(ev=><p className="mobis-cores-evento" key={ev.id}>
      <strong>{ev.tabela==="loja_paleta_publicada"?"Publicação":ev.acao==="insert"?"Versão criada":"Aprovação"}</strong>
      <small>{new Date(ev.quando).toLocaleString("pt-BR")} · responsável {ev.user_id?.slice(0,8)??"não informado"}…</small>
    </p>)}
  </section>
 </div>;
}
