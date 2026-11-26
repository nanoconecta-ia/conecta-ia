// Adaptador experimental entre readback histórico e gate de procedência.
// A porta deve ser controlada por auditor independente; nunca usar a credencial do produtor.
// Sem DML, rede própria, homologação ou transição.
import {extrair} from "../pipeline/extracao.ts";
import {conferirProcedencia,type Candidato,type PortaAuditoria,type Escopo} from "./procedencia_engenharia.ts";
export type ChaveEvidencia={loja:string;item:string;execucao:string;geracao:number;versao:number};
export interface PortaEvidenciaAuditoria extends PortaAuditoria {
 evidencia(chave:ChaveEvidencia):Promise<unknown>;
 // Registro de identidade emitido por autoridade do servidor, não pelo candidato.
 // Até existir adaptador real esta dependência é somente contrato.
 produtorRegistrado(chave:ChaveEvidencia):Promise<{chave:ChaveEvidencia;produtor:string;hashEntrada:string;hashExtracao:string}|null>;
}
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{64}$/.test(v);
const texto=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v===v.trim();
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("objeto inválido");return v as Record<string,unknown>};
const exato=(v:Record<string,unknown>,ks:string[])=>Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
// Comparação JSON estrutural, sem depender da ordem de chaves de JSONB.
function igual(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>igual(x,b[i]));
 if(!a||!b||typeof a!=="object"||typeof b!=="object")return false;
 const x=obj(a),y=obj(b);return exato(y,Object.keys(x))&&Object.keys(x).every(k=>igual(x[k],y[k]));
}
const opcional=(v:unknown)=>{if(v===null)return "";if(typeof v!=="string")throw Error("texto inválido");return v;};
const validaChave=(c:ChaveEvidencia)=>uuid(c.loja)&&uuid(c.item)&&uuid(c.execucao)&&Number.isSafeInteger(c.geracao)&&c.geracao>0&&Number.isSafeInteger(c.versao)&&c.versao>0;
export async function conferirEvidenciaPersistida(c:Candidato,chave:ChaveEvidencia,porta:PortaEvidenciaAuditoria,agora:string){
 const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
 try{
  if(!validaChave(chave))return negar("chave_invalida");
  const e=obj(await porta.evidencia(chave));
  if(e.estado!=="evidencia_historica"||e.loja_id!==chave.loja||e.item_id!==chave.item||e.execucao!==chave.execucao||e.geracao!==chave.geracao||e.versao!==chave.versao||e.homologada!==false||e.extrator!=="extracao_v1"||!hash(e.hash_entrada)||!hash(e.hash_extracao)||!uuid(e.produto_id)||!texto(e.revisao)||!texto(e.checkpoint))return negar("evidencia_divergente");
  const s=obj(e.entrada_snapshot),p=obj(s.produto);
  if(s.estado!=="preparada"||s.loja_id!==e.loja_id||s.item_id!==e.item_id||s.execucao!==e.execucao||s.geracao!==e.geracao||s.versao!==e.versao||s.revisao!==e.revisao||s.checkpoint!==e.checkpoint||p.id!==e.produto_id||!texto(p.sku)||!texto(p.nome)||!exato(p,["id","bling_id","sku","nome","marca","gtin","descricao_curta","descricao_complementar"]))return negar("snapshot_divergente");
  const derivada=extrair(p.sku,p.nome,[opcional(p.descricao_curta),opcional(p.descricao_complementar)].filter(Boolean).join(". "),opcional(p.marca),opcional(p.gtin));
  if(!igual(derivada,e.extracao_candidata))return negar("extracao_nao_reproduzivel");
  // OEM novo/externo precisa de outro fluxo explícito de identidade física.
  if(!derivada.codigos_oem.some(o=>o.normalizado===c.fato.oem))return negar("oem_sem_vinculo_candidato");
  // Piloto conservador: qualquer exclusão textual exige revisão específica.
  if(derivada.nao_se_aplica!==null)return negar("exclusao_a_revisar");
  const produtor=await porta.produtorRegistrado(chave);
  if(!produtor||!igual(produtor.chave,chave)||!texto(produtor.produtor)||produtor.hashEntrada!==e.hash_entrada||produtor.hashExtracao!==e.hash_extracao)return negar("produtor_nao_confirmado");
  const escopo:Escopo={loja:chave.loja,item:chave.item,execucao:chave.execucao,geracao:chave.geracao,versao:chave.versao,produto:e.produto_id,sku:p.sku,revisao:e.revisao,checkpoint:e.checkpoint,hashEntrada:e.hash_entrada,hashExtracao:e.hash_extracao,produtor:produtor.produtor};
  if(!igual(c.escopo,escopo))return negar("escopo_persistido_divergente");
  return await conferirProcedencia({...c,escopo},porta,agora);
 }catch{return negar("evidencia_nao_confirmada");}
}
