import { useState, type FormEvent } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
 "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
type Resposta = { situacao:"apto_consulta"|"restrito"|"analise_fiscal"; mensagem:string; pode_concluir_pedido:false };
/** Classifica a operação sem CPF/CNPJ reais. Cliente não faz cadastro no Conecta.IA. */
export function ConsultaFiscalProduto({ slug, sku }: { slug:string; sku:string }) {
  const [uf,setUf]=useState("");
  const [tipo,setTipo]=useState("cpf");
  const [icms,setIcms]=useState("nao_sei");
  const [finalidade,setFinalidade]=useState("uso_consumo");
  const [resultado,setResultado]=useState<Resposta|null>(null);
  const [ocupado,setOcupado]=useState(false);
  const limpar=()=>setResultado(null);
  async function verificar(e:FormEvent) {
    e.preventDefault(); setResultado(null);setOcupado(true);
    try {
      const r=await fetch(SUPABASE_URL+"/functions/v1/loja-elegibilidade",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_CHAVE_PUBLICAVEL},
        body:JSON.stringify({slug,sku,uf_destino:uf,tipo_destinatario:tipo,contribuinte_icms:icms,finalidade}),
      });
      const j=await r.json().catch(()=>({}));
      setResultado(r.ok && j?.situacao ? j as Resposta : {
        situacao:"analise_fiscal",pode_concluir_pedido:false,
        mensagem:"A conferência fiscal ainda não está disponível. Solicite análise do vendedor antes de comprar."
      });
    } catch {
      setResultado({situacao:"analise_fiscal",pode_concluir_pedido:false,
        mensagem:"Não foi possível consultar as regras fiscais. A venda não está autorizada automaticamente."});
    } finally {setOcupado(false)}
  }
  return <section className="consulta-fiscal-produto" aria-label="Condições de venda por estado e tipo de comprador">
    <h2>Verificar condições de venda para o seu estado</h2>
    <p>Esta consulta verifica UF, tipo de comprador e finalidade. Não pedimos CPF, CNPJ, dados bancários ou endereço nesta etapa.</p>
    <form onSubmit={verificar}>
      <label>Estado de entrega
        <select value={uf} required onChange={e=>{setUf(e.target.value);limpar();}}>
          <option value="">Escolha a UF</option>{ESTADOS.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <label>Tipo de comprador
        <select value={tipo} onChange={e=>{setTipo(e.target.value);limpar();}}>
          <option value="cpf">Pessoa física (CPF)</option><option value="cnpj">Pessoa jurídica (CNPJ)</option>
        </select>
      </label>
      <label>Contribui para o ICMS?
        <select value={icms} onChange={e=>{setIcms(e.target.value);limpar();}}>
          <option value="nao_sei">Não sei / preciso confirmar</option><option value="sim">Sim</option><option value="nao">Não</option>
        </select>
      </label>
      <label>Finalidade da aquisição
        <select value={finalidade} onChange={e=>{setFinalidade(e.target.value);limpar();}}>
          <option value="uso_consumo">Uso e consumo</option><option value="revenda">Revenda</option>
          <option value="ativo_imobilizado">Ativo imobilizado</option>
        </select>
      </label>
      <button type="submit" disabled={!uf || ocupado}>{ocupado?"Conferindo…":"Consultar condição de venda"}</button>
    </form>
    {resultado && <div className={"consulta-fiscal-retorno "+resultado.situacao} role="status">
      <strong>{resultado.situacao==="restrito"?"Venda restrita nesta modalidade":
        resultado.situacao==="apto_consulta"?"Pré-triagem favorável · falta confirmação fiscal":"Sujeita à análise fiscal"}</strong>
      <p>{resultado.mensagem}</p>
      <small>Esta verificação não é uma autorização de cobrança, emissão de NF ou pedido. O Bling e o contador conferem os dados finais.</small>
    </div>}
    <p className="consulta-fiscal-privacidade">O cadastro completo, quando necessário e autorizado, será encaminhado ao ERP Bling por conexão segura. Pagamentos devem usar um prestador autorizado: não digite informações de cartão ou conta bancária no chat.</p>
  </section>;
}
