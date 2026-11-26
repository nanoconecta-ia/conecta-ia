// Adaptador experimental, exclusivamente servidor. Não é cliente PostgREST nem
// provisiona conexão: o chamador deve fornecer uma sessão PostgreSQL dedicada
// ao auditor, com parâmetros vinculados pelo driver e sem reconexão implícita.
import {conferirEvidenciaPersistida,type ChaveEvidencia,type PortaEvidenciaAuditoria} from "./evidencia_procedencia.ts";
import type {Candidato,Documento,Escopo,FonteAutorizada,LeituraIndependente} from "./procedencia_engenharia.ts";
export interface SessaoAuditoriaSql {
 consultar(sql:string,parametros:readonly (string|number)[]):Promise<readonly unknown[]>;
}
const Q={
 identidade:"select session_user::text as identidade, nano_lifecycle_interno.nano_lifecycle_verificador_autorizado($1::uuid,session_user::text) as autorizado",
 evidencia:"select nano_lifecycle_interno.nano_lifecycle_ler_evidencia($1::uuid,$2::uuid,$3::bigint) as valor",
 autoria:"select nano_lifecycle_interno.nano_lifecycle_ler_autoria($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::integer) as valor",
 fonte:"select nano_lifecycle_interno.nano_lifecycle_ler_fonte($1::uuid,$2::text) as valor",
 documento:"select nano_lifecycle_interno.nano_lifecycle_ler_documento($1::uuid,$2::text) as valor",
 pareceres:"select nano_lifecycle_interno.nano_lifecycle_ler_pareceres($1::uuid,$2::text,$3::text,$4::jsonb) as valor",
 autorizado:"select nano_lifecycle_interno.nano_lifecycle_verificador_autorizado($1::uuid,$2::text) as valor",
} as const;
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const inteiro=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
const registro=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const campos=(v:unknown,ks:string[]):v is Record<string,unknown>=>registro(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
export async function conferirComAuditorSql(c:Candidato,chave:ChaveEvidencia,sessao:SessaoAuditoriaSql,identidadeConfigurada:string,agora:string){
 const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
 try{
  if(!chave||![chave.loja,chave.item,chave.execucao].every(uuid)||!inteiro(chave.geracao)||!inteiro(chave.versao)||chave.versao>2147483647||!identidadeConfigurada||new TextEncoder().encode(identidadeConfigurada).length>63)return negar("escopo_sql_invalido");
  // Captura imutável da chave: não permite troca de loja entre awaits.
  const k=Object.freeze({...chave});
  const linha=async(q:string,p:readonly (string|number)[],ks:string[])=>{
   const rows=await sessao.consultar(q,p);
   if(!Array.isArray(rows)||rows.length!==1||!campos(rows[0],ks))throw Error("resposta SQL inesperada");
   return rows[0];
  };
  const identidade=async()=>{
   const l=await linha(Q.identidade,[k.loja],["identidade","autorizado"]);
   return l.identidade===identidadeConfigurada&&l.autorizado===true;
  };
  const valor=async(q:string,p:readonly (string|number)[])=>{
   // A própria RPC valida autorização; o adaptador não executa SQL arbitrário.
   return (await linha(q,p,["valor"])).valor;
  };
  const loja=(l:string)=>{if(l!==k.loja)throw Error("loja divergente");};
  const mesmaChave=(x:ChaveEvidencia)=>{if(x.loja!==k.loja||x.item!==k.item||x.execucao!==k.execucao||x.geracao!==k.geracao||x.versao!==k.versao)throw Error("chave divergente");};
  if(!(await identidade()))return negar("sessao_auditoria_nao_confirmada");
  const porta:PortaEvidenciaAuditoria={
   evidencia:async(x)=>{mesmaChave(x);return valor(Q.evidencia,[k.loja,k.item,k.geracao]);},
   produtorRegistrado:async(x)=>{mesmaChave(x);const v=await valor(Q.autoria,[k.loja,k.item,k.execucao,k.geracao,k.versao]);if(v===null)return null;if(!campos(v,["chave","produtor","hashEntrada","hashExtracao"]))throw Error("autoria inválida");return v as unknown as Awaited<ReturnType<PortaEvidenciaAuditoria["produtorRegistrado"]>>;},
   fonte:async(l,id)=>{loja(l);const v=await valor(Q.fonte,[l,id]);if(v===null)return null;if(!campos(v,["id","loja","tipo","emissor","autorizada"]))throw Error("fonte inválida");return v as unknown as FonteAutorizada;},
   documento:async(l,id)=>{loja(l);const v=await valor(Q.documento,[l,id]);if(v===null)return null;if(!campos(v,["id","loja","fonteId","conteudo","sha256","consultadoEm"]))throw Error("documento inválido");return v as unknown as Documento;},
   leituras:async(l,doc,loc,escopo:Escopo)=>{loja(l);mesmaChave(escopo);const v=await valor(Q.pareceres,[l,doc,loc,JSON.stringify(escopo)]);if(!Array.isArray(v)||v.some(x=>!campos(x,["id","escopo","fonteId","documentoId","sha256","localizador","fato","verificador","verificadoEm","resultado"])))throw Error("parecer inválido");return v as LeituraIndependente[];},
   verificadorAutorizado:async(l,id)=>{loja(l);return (await valor(Q.autorizado,[l,id]))===true;},
  };
  const r=await conferirEvidenciaPersistida(c,k,porta,agora);
  if(r.estado!=="procedencia_conferida")return r;
  // Revalida a sessão no retorno. Não garante ausência de revogação posterior;
  // consumidor deve revalidar no futuro gate de transição.
  if(!(await identidade()))return negar("sessao_auditoria_revogada");
  return r;
 }catch{return negar("transporte_auditoria_nao_confirmado");}
}

/** Conferência pontual de atualidade depois da procedência histórica. Não autoriza DML. */
export async function conferirEvidenciaAtualComAuditorSql(c:Candidato,chave:ChaveEvidencia,sessao:SessaoAuditoriaSql,identidadeConfigurada:string,agora:string){
 const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
 try{
  // Clona o candidato antes de qualquer await para impedir troca do escopo.
  const candidato=structuredClone(c), k=Object.freeze({...chave});
  const r=await conferirComAuditorSql(candidato,k,sessao,identidadeConfigurada,agora);
  if(r.estado!=="procedencia_conferida")return r;
  const rows=await sessao.consultar("select session_user::text as identidade, nano_lifecycle_interno.nano_lifecycle_conferir_atualidade($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::integer,$6::jsonb) as atual",[k.loja,k.item,k.execucao,k.geracao,k.versao,JSON.stringify(candidato.escopo)]);
  if(!Array.isArray(rows)||rows.length!==1||!campos(rows[0],["identidade","atual"])||rows[0].identidade!==identidadeConfigurada||rows[0].atual!==true)return negar("evidencia_desatualizada_ou_indisponivel");
  return {...r,atualidade:"conferida_no_instante" as const};
 }catch{return negar("atualidade_nao_confirmada");}
}

/** Pré-gate de leitura consistente, NÃO uma autorização persistente ou de escrita. */
export async function conferirPreGateSql(c:Candidato,chave:ChaveEvidencia,sessao:SessaoAuditoriaSql,identidadeConfigurada:string,agora:string){
 const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
 try{
  const candidato=structuredClone(c), k=Object.freeze({...chave});
  const r=await conferirComAuditorSql(candidato,k,sessao,identidadeConfigurada,agora);
  if(r.estado!=="procedencia_conferida")return r;
  const rows=await sessao.consultar("select session_user::text as identidade, nano_lifecycle_interno.nano_lifecycle_pre_gate($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::integer,$6::jsonb,$7::uuid,$8::text) as conforme",[k.loja,k.item,k.execucao,k.geracao,k.versao,JSON.stringify(candidato),r.leituraId,r.sha256]);
  if(!Array.isArray(rows)||rows.length!==1||!campos(rows[0],["identidade","conforme"])||rows[0].identidade!==identidadeConfigurada||rows[0].conforme!==true)return negar("pre_gate_retido");
  return {...r,preGate:"conforme_no_snapshot" as const};
 }catch{return negar("pre_gate_nao_confirmado");}
}
