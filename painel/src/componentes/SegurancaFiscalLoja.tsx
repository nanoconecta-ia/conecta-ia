import { useEffect,useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { UFS_BR } from "../../supabase/functions/_shared/loja/triagem_fiscal.ts";

type Regra={id:string;produto_id:string;uf_destino:string;tipo_destinatario:string;contribuinte_icms:string;
 finalidade:string;decisao:string;status:string;validado_em:string|null};
type Fiscal={uf:string|null;regime:string|null;validado_em:string|null};
/** Monitor administrativo SOMENTE LEITURA. Regras editadas fora deste painel somente após validação do contador. */
export function SegurancaFiscalLoja({ loja }: { loja:Loja }) {
 const [fiscal,setFiscal]=useState<Fiscal|null>(null);
 const [regras,setRegras]=useState<Regra[]>([]);
 const [estado,setEstado]=useState<"carregando"|"ok"|"incompleto">("carregando");
 useEffect(()=>{
  let vivo=true;setEstado("carregando");
  void Promise.all([
   supabase.from("loja_fiscal").select("uf,regime,validado_em").eq("loja_id",loja.id).maybeSingle(),
   supabase.from("loja_regras_venda_uf")
    .select("id,produto_id,uf_destino,tipo_destinatario,contribuinte_icms,finalidade,decisao,status,validado_em")
    .eq("loja_id",loja.id).limit(500),
  ]).then(([a,b])=>{
   if(!vivo)return;
   setFiscal(!a.error?a.data as Fiscal|null:null);
   setRegras(!b.error?b.data as Regra[]??[]:[]);
   setEstado(a.error||b.error?"incompleto":"ok");
  }).catch(()=>vivo&&setEstado("incompleto"));
  return()=>{vivo=false};
 },[loja.id]);
 const validas=regras.filter(r=>r.status==="validada" && !!r.validado_em);
 const autorizacoes=validas.filter(r=>r.decisao==="liberar_atendimento").length;
 const bloqueios=validas.filter(r=>r.decisao==="bloquear").length;
 const pronto=!!fiscal?.uf && !!fiscal?.regime && !!fiscal?.validado_em;
 return <section className="cartao fiscal-seguranca-admin" aria-label="Segurança fiscal de vendas interestaduais">
   <h2>Segurança fiscal · vendas por estado</h2>
   <p className="suave">Monitor de pré-triagem. Produto e nota pertencem ao Bling; a loja só consulta uma decisão específica validada pelo contador.
     Conecta.IA não armazena clientes, CPF/CNPJ ou dados de pagamento neste módulo.</p>
   <p role="status" className={pronto?"msg-ok":"msg-erro"}>
     {pronto?"Configuração fiscal da loja registrada e revisada.":"Bloqueio preventivo: UF, regime ou validação do contador da loja pendente."}
   </p>
   <div className="fiscal-adm-contagens">
    <div><strong>{autorizacoes}</strong><span>Triagens favoráveis para atendimento</span></div>
    <div><strong>{bloqueios}</strong><span>Combinações expressamente restritas</span></div>
    <div><strong>{regras.filter(r=>r.status!=="validada").length}</strong><span>Regras ainda sem aprovação</span></div>
   </div>
   {estado==="incompleto" && <p className="msg-erro">A matriz segura ainda não foi implantada ou não está acessível. Nenhum estado deve ser presumido liberado.</p>}
   <h3>UFS de destino · cobertura das regras revisadas</h3>
   <div className="fiscal-adm-ufs" aria-label="27 UFs e sua cobertura">
    {UFS_BR.map(uf=>{
      const rs=validas.filter(r=>r.uf_destino===uf);
      return <span key={uf} title={rs.length?rs.length+" combinações validadas (não abrangem todas as operações)":"Sem política validada"}>
        <b>{uf}</b><small>{rs.length?rs.length+" regra(s)":"Revisar"}</small>
      </span>;
    })}
   </div>
   <p className="suave">Uma UF com regra validada não significa liberação geral: cada combinação exige produto, tipo de comprador, contribuinte ICMS e finalidade corretos.
     Sem linha específica ou com regra vencida, a triagem permanece pendente.</p>
   <p className="suave">A aprovação fiscal exige número da norma, fonte oficial, vigência e identificação do contador. Somente integração autorizada poderá criar a regra. Não há escrita fiscal neste painel.</p>
 </section>;
}
