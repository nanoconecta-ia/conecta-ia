// Preparação determinística, não transição do pipeline. Somente servidor.
// Nenhum conector externo, custo, escrita no ERP ou aprovação de aplicação.
import {extrair} from "../pipeline/extracao.ts";
import type {RpcServidor} from "./porta_supabase.ts";
export type ReservaEngenharia={loja:string;item:string;execucao:string;geracao:number;versao:number};
const objeto=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=="object"||Array.isArray(x))throw Error("resposta inválida");return x as Record<string,unknown>};
const exato=(x:Record<string,unknown>,ks:string[])=>{if(Object.keys(x).length!==ks.length||ks.some(k=>!Object.hasOwn(x,k)))throw Error("campos inesperados")};
const texto=(x:unknown)=>{if(typeof x!=="string"||!x.trim())throw Error("texto obrigatório");return x};
const opcional=(x:unknown)=>{if(x!==null&&typeof x!=="string")throw Error("texto inválido");return x??"" as string};
const token=(x:unknown)=>typeof x==="string"&&/^[A-Za-z0-9_-]{8,96}$/.test(x);
const uuid=(x:unknown)=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);
async function prepararComSnapshot(admin:RpcServidor,reserva:ReservaEngenharia){
 if(![reserva.loja,reserva.item,reserva.execucao].every(uuid)||!Number.isSafeInteger(reserva.geracao)||reserva.geracao<1||!Number.isSafeInteger(reserva.versao)||reserva.versao<1)throw Error("reserva inválida");
 const r=await admin.rpc("nano_lifecycle_entrada_tecnica",{p_loja:reserva.loja,p_item:reserva.item,p_execucao:reserva.execucao,p_geracao:reserva.geracao,p_versao:reserva.versao});
 if(r.error)throw Error("leitura técnica não confirmada");
 const x=objeto(r.data);
 if(x.estado!=="preparada"){
  const estados=new Set(["desabilitado","item_inexistente","reserva_invalida","dados_tecnicos_incompletos","sync_em_andamento","evento_inexistente","revisao_a_reconciliar","identidade_a_revisar","revisar_inativacao","inativo","ocupado","pausado","conflito_idempotencia","pipeline_ativo_aguardar","orcamento_indisponivel"]);
  exato(x,["estado"]);if(typeof x.estado!=="string"||!estados.has(x.estado))throw Error("estado desconhecido");
  return {estado:"retida" as const,motivo:x.estado};
 }
 exato(x,["estado","loja_id","item_id","execucao","geracao","versao","revisao","checkpoint","produto"]);
 if(x.loja_id!==reserva.loja||x.item_id!==reserva.item||x.execucao!==reserva.execucao||x.geracao!==reserva.geracao||x.versao!==reserva.versao||!token(x.revisao)||!token(x.checkpoint))throw Error("escopo divergente");
 const p=objeto(x.produto);
 exato(p,["id","bling_id","sku","nome","marca","gtin","descricao_curta","descricao_complementar"]);
 if(!uuid(p.id)||typeof p.bling_id!=="string"||!/^[1-9][0-9]*$/.test(p.bling_id))throw Error("identidade inválida");
 const sku=texto(p.sku),nome=texto(p.nome),marca=opcional(p.marca),gtin=opcional(p.gtin);
 const descricao=[opcional(p.descricao_curta),opcional(p.descricao_complementar)].filter(Boolean).join(". ");
 const extracao=extrair(sku,nome,descricao,marca,gtin);
 return {estado:"preparada" as const,produto_id:p.id,bling_id:p.bling_id,revisao:x.revisao,checkpoint:x.checkpoint,extracao,homologada:false as const,entrada:x};
}

export async function prepararEntradaEngenharia(admin:RpcServidor,reserva:ReservaEngenharia){
 const r=await prepararComSnapshot(admin,reserva);
 if(r.estado!=="preparada")return r;
 const {entrada:_,...resultado}=r;return resultado;
}
// Sem chamada externa. O resultado permanece candidato; a RPC revalida o snapshot.
export async function persistirResultadoEngenharia(admin:RpcServidor,reserva:ReservaEngenharia){
 const p=await prepararComSnapshot(admin,reserva);
 if(p.estado!=="preparada")return p;
 const r=await admin.rpc("nano_lifecycle_persistir_engenharia",{p_loja:reserva.loja,p_item:reserva.item,p_execucao:reserva.execucao,p_geracao:reserva.geracao,p_versao:reserva.versao,p_entrada:p.entrada,p_extracao:p.extracao});
 if(r.error)throw Error("persistência técnica não confirmada");
 const x=objeto(r.data);
 if(x.estado!=="gravado"&&x.estado!=="ja_gravado"){
  exato(x,["estado"]);
  if(typeof x.estado!=="string"||!new Set(["desabilitado","item_inexistente","reserva_invalida","dados_tecnicos_incompletos","sync_em_andamento","evento_inexistente","revisao_a_reconciliar","identidade_a_revisar","revisar_inativacao","inativo","ocupado","pausado","conflito_idempotencia","pipeline_ativo_aguardar","orcamento_indisponivel","snapshot_divergente","extracao_invalida","resultado_divergente"]).has(x.estado))throw Error("estado de persistência desconhecido");
  return {estado:"retida" as const,motivo:x.estado};
 }
 exato(x,["estado","hash_entrada","hash_extracao","homologada"]);
 if(x.homologada!==false||typeof x.hash_entrada!=="string"||typeof x.hash_extracao!=="string"||!(/^[a-f0-9]{64}$/).test(x.hash_entrada)||!(/^[a-f0-9]{64}$/).test(x.hash_extracao))throw Error("recibo inválido");
 return {estado:x.estado,hash_entrada:x.hash_entrada,hash_extracao:x.hash_extracao,homologada:false as const};
}

// Recuperação explícita de recibo histórico. Não recupera lease nem reexecuta extração.
export async function recuperarReciboEngenharia(admin:RpcServidor,reserva:ReservaEngenharia){
 if(![reserva.loja,reserva.item,reserva.execucao].every(uuid)||!Number.isSafeInteger(reserva.geracao)||reserva.geracao<1||!Number.isSafeInteger(reserva.versao)||reserva.versao<1)throw Error("reserva inválida");
 const r=await admin.rpc("nano_lifecycle_recibo_engenharia",{p_loja:reserva.loja,p_item:reserva.item,p_execucao:reserva.execucao,p_geracao:reserva.geracao,p_versao:reserva.versao});
 if(r.error)throw Error("recibo não confirmado");
 const x=objeto(r.data);
 if(x.estado==="recibo_inexistente"||x.estado==="integridade_divergente"){exato(x,["estado"]);return {estado:"retida" as const,motivo:x.estado};}
 exato(x,["estado","loja_id","item_id","execucao","geracao","versao","hash_entrada","hash_extracao","homologada"]);
 if(x.estado!=="recuperado"||x.loja_id!==reserva.loja||x.item_id!==reserva.item||x.execucao!==reserva.execucao||x.geracao!==reserva.geracao||x.versao!==reserva.versao||x.homologada!==false||typeof x.hash_entrada!=="string"||typeof x.hash_extracao!=="string"||!(/^[a-f0-9]{64}$/).test(x.hash_entrada)||!(/^[a-f0-9]{64}$/).test(x.hash_extracao))throw Error("recibo histórico divergente");
 return {estado:"recuperado" as const,hash_entrada:x.hash_entrada,hash_extracao:x.hash_extracao,homologada:false as const};
}
