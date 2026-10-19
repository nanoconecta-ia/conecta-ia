import {useEffect,useState} from 'react';
import {supabase} from '../supabase.ts';
import {ROTULOS_ESCOPO} from '../lib/pair.ts';
type Pedido={nome:string;redirect_uri:string;state:string;escopos:string[];offline:boolean;lojas:{id:string;nome:string}[];duracao_min:number};
export function AutorizarAgente({codigo}:{codigo:string}) {
  const [pedido,setPedido]=useState<Pedido|null>(null),[erro,setErro]=useState(''),[loja,setLoja]=useState('');
  const [escopos,setEscopos]=useState<string[]>([]),[duracao,setDuracao]=useState(15),[offline,setOffline]=useState(false),[ocupado,setOcupado]=useState(false),[reentrar,setReentrar]=useState(false);
  useEffect(()=>{let vivo=true;setPedido(null);setErro('');
    if(!/^[A-Za-z0-9_-]{43}$/.test(codigo)){setErro('Pedido de autorização inválido. Reinicie a conexão no cliente do agente.');return}
    void supabase.rpc('oauth_pair_detalhe',{p_codigo:codigo}).then(({data,error})=>{
      if(!vivo)return;if(error||!data){setErro('Pedido expirado ou indisponível. Reinicie a conexão no cliente do agente.');return}
      const d=data as Pedido;setPedido(d);setEscopos(d.escopos);setOffline(d.offline);setDuracao(Math.min(15,d.duracao_min));if(d.lojas.length===1)setLoja(d.lojas[0].id);
    });return()=>{vivo=false};
  },[codigo]);
  async function decidir(aprovar:boolean){
    if(!pedido)return;setOcupado(true);setErro('');
    const {data,error}=aprovar?await supabase.rpc('oauth_pair_aprovar',{p_codigo:codigo,p_loja:loja,p_escopos:escopos,p_duracao:duracao,p_offline:offline}):await supabase.rpc('pair_recusar',{p_codigo:codigo});
    if(error||data?.ok!==true){setOcupado(false);if(data?.motivo==='reconfirmacao_necessaria'){setReentrar(true);setErro('Confirme seu login novamente para autorizar este agente.')}else setErro('Não foi possível concluir. O pedido pode ter expirado; nenhuma permissão adicional foi concedida.');return}
    const destino=new URL(aprovar?data.redirect_uri:pedido.redirect_uri);destino.searchParams.set('state',aprovar?data.state:pedido.state);
    destino.searchParams.set(aprovar?'code':'error',aprovar?codigo:'access_denied');window.location.assign(destino.toString());
  }
  return <main className="entrar" style={{maxWidth:600}}>
    <h1>Autorizar agente</h1>
    <p>Escolha a empresa e as permissões que este agente poderá usar. A sessão pode ser revogada em Dispositivos.</p>
    {erro&&<p className="msg-erro" role="alert">{erro}</p>}
    {!pedido&&!erro&&<p role="status">Conferindo pedido…</p>}
    {pedido&&<>
      <div className="cartao"><h2>{pedido.nome}</h2><p>Retorno ao cliente: <strong style={{overflowWrap:'anywhere'}}>{new URL(pedido.redirect_uri).host}</strong></p><p>Verifique se reconhece este aplicativo. A conexão entrega acesso apenas à empresa e às ferramentas abaixo.</p></div>
      <label>Empresa<select value={loja} onChange={e=>setLoja(e.target.value)} disabled={ocupado}><option value="">Selecione a empresa</option>{pedido.lojas.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
      {!pedido.lojas.length&&<p>Seu usuário não administra uma empresa disponível para este pedido.</p>}
      <fieldset disabled={ocupado}><legend>Permissões solicitadas</legend>{pedido.escopos.map(e=><label className="marcar" key={e}><input type="checkbox" checked={escopos.includes(e)} onChange={()=>setEscopos(v=>v.includes(e)?v.filter(x=>x!==e):[...v,e])}/>{ROTULOS_ESCOPO[e]??e}</label>)}</fieldset>
      <label>Duração da sessão<select value={duracao} onChange={e=>setDuracao(Number(e.target.value))} disabled={ocupado}>{[5,15,30,60].filter(v=>v<=pedido.duracao_min).map(v=><option value={v} key={v}>{v} minutos</option>)}</select></label>
      {pedido.offline&&<label className="marcar"><input type="checkbox" checked={offline} disabled={ocupado} onChange={e=>setOffline(e.target.checked)}/>Permitir renovação do token somente dentro desse prazo.</label>}
      <p>O agente não recebe senha, JWT do sistema ou credencial Bling. Ele não aprova propostas nem grava produtos no ERP.</p>
      <button disabled={ocupado||!loja||!escopos.length||reentrar} onClick={()=>void decidir(true)}>Autorizar acesso</button>
      <button className="sec" disabled={ocupado} onClick={()=>void decidir(false)}>Recusar</button>
      {reentrar&&<button className="sec" onClick={()=>void supabase.auth.signOut()}>Entrar novamente</button>}
    </>}
  </main>;
}
