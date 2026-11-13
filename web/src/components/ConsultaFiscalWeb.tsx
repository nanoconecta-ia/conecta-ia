"use client";
import { useState, type FormEvent } from "react";

const UFS=["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
type Resposta={situacao:"apto_consulta"|"restrito"|"analise_fiscal";mensagem:string;pode_concluir_pedido:false};
const PENDENTE:Resposta={situacao:"analise_fiscal",mensagem:"A análise fiscal deve ser feita pela equipe antes da venda. Nenhum pagamento está autorizado por esta consulta.",pode_concluir_pedido:false};
export function ConsultaFiscalWeb({ slug,sku }: { slug:string;sku:string }) {
  const [uf,setUf]=useState(""),[tipo,setTipo]=useState("cpf"),[contrib,setContrib]=useState("nao_sei"),[finalidade,setFinalidade]=useState("uso_consumo");
  const [resultado,setResultado]=useState<Resposta|null>(null),[ocupado,setOcupado]=useState(false);
  const reset=()=>setResultado(null);
  async function verificar(e:FormEvent) {
    e.preventDefault();setOcupado(true);setResultado(null);
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url || !key){setResultado(PENDENTE);setOcupado(false);return;}
    try {
      const r=await fetch(url+"/functions/v1/loja-elegibilidade",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:key},
        body:JSON.stringify({slug,sku,uf_destino:uf,tipo_destinatario:tipo,contribuinte_icms:contrib,finalidade})
      });
      const j=await r.json().catch(()=>({}));
      setResultado(r.ok && ["apto_consulta","restrito","analise_fiscal"].includes(j.situacao)?j as Resposta:PENDENTE);
    }catch{setResultado(PENDENTE)}
    finally{setOcupado(false)}
  }
  return <section className="mobis-web-fiscal" aria-label="Conferência fiscal por UF">
    <h2>Conferir condições de venda no seu estado</h2>
    <p>Selecione apenas categorias. Não informe número de CPF/CNPJ, dados bancários ou endereço aqui.</p>
    <form onSubmit={verificar}>
      <label>UF de entrega<select required value={uf} onChange={e=>{setUf(e.target.value);reset();}}>
        <option value="">Selecionar UF</option>{UFS.map(x=><option key={x} value={x}>{x}</option>)}
      </select></label>
      <label>Comprador<select value={tipo} onChange={e=>{setTipo(e.target.value);reset();}}>
        <option value="cpf">Pessoa física (CPF)</option><option value="cnpj">Empresa (CNPJ)</option>
      </select></label>
      <label>Contribuinte ICMS<select value={contrib} onChange={e=>{setContrib(e.target.value);reset();}}>
        <option value="nao_sei">Não sei</option><option value="sim">Sim</option><option value="nao">Não</option>
      </select></label>
      <label>Finalidade<select value={finalidade} onChange={e=>{setFinalidade(e.target.value);reset();}}>
        <option value="uso_consumo">Uso/consumo</option><option value="revenda">Revenda</option>
        <option value="ativo_imobilizado">Ativo imobilizado</option>
      </select></label>
      <button disabled={!uf||ocupado}>{ocupado?"Conferindo…":"Verificar condição fiscal"}</button>
    </form>
    {resultado && <div className="mobis-web-fiscal-status" role="status">
      <strong>{resultado.situacao==="restrito"?"Modalidade restrita":
        resultado.situacao==="apto_consulta"?"Pré-triagem favorável":"Necessária análise fiscal"}</strong>
      <p>{resultado.mensagem}</p>
      <small>Esta consulta não cria contato, pedido, pagamento ou nota. O Bling deve confirmar a operação.</small>
    </div>}
  </section>;
}
