// Porta consultiva servidor; sessão dedicada do auditor, nunca cliente/ERP.
import type {SessaoAuditoriaSql} from "./porta_auditoria_sql.ts";
import {reconciliarDecisaoCatalogo,type EscopoDecisaoCatalogo,type EventoDecisaoCatalogo} from "./decisao_catalogo.ts";
const consulta="select session_user::text as identidade, nano_lifecycle_interno.nano_catalogo_ler_decisao($1::uuid,$2::uuid,$3::uuid) as valor";
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const campos=(v:unknown,k:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
/** RPC 109 verifica autorização e retorna snapshot consistente. Não prova
 * a identidade do autor humano nem a revisão da engenharia. Não autoriza escrita.
 */
export async function conferirDecisaoCatalogoSql(escopo:EscopoDecisaoCatalogo,sessao:SessaoAuditoriaSql,identidadeConfigurada:string){
 try{
  const e=structuredClone(escopo);
  if(![e.loja_id,e.produto_id,e.aplicacao_id].every(uuid)||typeof identidadeConfigurada!=="string"||!identidadeConfigurada.trim()||new TextEncoder().encode(identidadeConfigurada).length>63)return negar("escopo_sql_invalido");
  const rows=await sessao.consultar(consulta,[e.loja_id,e.produto_id,e.aplicacao_id]);
  if(!Array.isArray(rows)||rows.length!==1||!campos(rows[0],["identidade","valor"])||rows[0].identidade!==identidadeConfigurada)return negar("sessao_catalogo_nao_confirmada");
  const v=rows[0].valor;
  if(!campos(v,["atual","eventos","agora"])||typeof v.agora!=="string"||!Array.isArray(v.eventos)||v.eventos.some(x=>!campos(x,["id","quando","loja_id","user_id","acao","tabela","antes","depois"])))return negar("snapshot_catalogo_indisponivel");
  return reconciliarDecisaoCatalogo(e,v.atual,v.eventos as EventoDecisaoCatalogo[],v.agora);
 }catch{return negar("transporte_catalogo_nao_confirmado");}
}
