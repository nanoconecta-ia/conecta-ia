// Reconciliação consultiva da autoridade legada public.aplicacao_decidir / auditoria.
// Entrada exclusiva de adaptador servidor confiável em snapshot consistente.
// Não cria decisão, não lê banco, não homologa nem emite prova SEO.
type Linha=Record<string,unknown>;
export interface EscopoDecisaoCatalogo {loja_id:string;produto_id:string;aplicacao_id:string}
export interface EventoDecisaoCatalogo {
 id:string;quando:string;loja_id:string;user_id:string|null;acao:string;tabela:string;antes:unknown;depois:unknown;
}
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const obj=(v:unknown):v is Linha=>!!v&&typeof v==="object"&&!Array.isArray(v);
function igual(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>igual(x,b[i]));
 return obj(a)&&obj(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&igual(a[k],b[k]));
}
const identidade=(r:unknown,e:EscopoDecisaoCatalogo):r is Linha=>obj(r)&&r.id===e.aplicacao_id&&r.loja_id===e.loja_id&&r.produto_id===e.produto_id;
const statusOk=(s:unknown)=>["a_confirmar","aprovado","desatualizado","rejeitado"].includes(String(s));
// Aceita somente o formato ISO emitido pelo PostgreSQL, com fuso explícito.
const instante=(s:unknown):s is string=>{
 if(typeof s!=="string")return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(s);
 if(!m||m[0]!==s)return false;
 const [ano,mes,dia,hora,minuto,segundo]=m.slice(1,7).map(Number);
 const dias=[31,ano%4===0&&(ano%100!==0||ano%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 return ano>0&&mes>=1&&mes<=12&&dia>=1&&dia<=dias[mes-1]&&hora<=23&&minuto<=59&&segundo<=59
  &&(m[8]===undefined||(Number(m[8])<=15&&Number(m[9])<=59))&&Number.isFinite(Date.parse(s));
};
// PostgreSQL mantém seis casas decimais em timestamptz; Date.parse retém três.
function microssegundos(s:string):bigint {
 const milissegundos=Date.parse(s);
 const fracao=s.match(/T\d{2}:\d{2}:\d{2}\.(\d+)/)?.[1]??"";
 if(fracao.length>6)throw Error("precisão fora do contrato PostgreSQL");
 return BigInt(milissegundos)*1000n+BigInt(fracao.padEnd(6,"0").slice(3));
}
const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
/** Historico completo das decisões da aplicação no mesmo snapshot, sem truncar.
 * Rejeita cadeia ambígua, troca de identidade e edição desde a decisão.
 * O ID de auditoria é bigint decimal em texto; não converter para number.
 * Estado aprovado legado não é aprovação independente nem prova de atualidade do lifecycle.
 */
export function reconciliarDecisaoCatalogo(e:EscopoDecisaoCatalogo,atual:unknown,eventos:readonly EventoDecisaoCatalogo[],agora:string){
 try{
  if(![e.loja_id,e.produto_id,e.aplicacao_id].every(uuid)||!identidade(atual,e)||!instante(agora))return negar("escopo_invalido");
  if(!Array.isArray(eventos)||eventos.length===0)return negar("historico_ausente");
  if(eventos.some(x=>!x||typeof x.id!=="string"||!/^[1-9]\d{0,18}$/.test(x.id)||BigInt(x.id)>9223372036854775807n))return negar("evento_invalido");
  const ordenados=[...eventos].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0);
  let anterior:EventoDecisaoCatalogo|undefined;
  for(const ev of ordenados){
   if(ev.loja_id!==e.loja_id||ev.tabela!=="produto_aplicacoes"||!uuid(ev.user_id)||!instante(ev.quando)||microssegundos(ev.quando)>microssegundos(agora)||!identidade(ev.antes,e)||!identidade(ev.depois,e)||!statusOk(ev.antes.status))return negar("evento_fora_do_escopo");
   const status=ev.acao==="aplicacao.aprovar"?"aprovado":ev.acao==="aplicacao.rejeitar"?"rejeitado":null;
   // A minuta 105 permite exclusivamente retirar a visibilidade junto à rejeição.
   // Aprovação nunca eleva visibilidade. Flag ausente/ilegível não prova o contrato.
   if(!status||typeof ev.antes.pagina_indexavel!=="boolean"||typeof ev.depois.pagina_indexavel!=="boolean")return negar("decisao_divergente");
   const esperado={...ev.antes,status,pagina_indexavel:status==="rejeitado"?false:ev.antes.pagina_indexavel};
   if(!igual(esperado,ev.depois)||ev.antes.pagina_indexavel===true&&ev.antes.status!=="aprovado")return negar("decisao_divergente");
   if(anterior&&(ev.id===anterior.id||microssegundos(ev.quando)<=microssegundos(anterior.quando)||!igual(anterior.depois,ev.antes)))return negar("cadeia_ambigua");
   anterior=ev;
  }
  const ultimo=anterior!;
  if(!igual(ultimo.depois,atual))return negar("snapshot_alterado");
  if(ultimo.acao==="aplicacao.rejeitar")return {estado:"rejeitada_legada" as const,homologada:false as const,evento_id:ultimo.id};
  if(typeof atual.fonte!=="string"||!atual.fonte.trim()||!instante(atual.coletado_em)||microssegundos(atual.coletado_em)>microssegundos(ultimo.quando))return negar("fonte_nao_confirmada");
  return {estado:"aprovacao_legada_conferida" as const,homologada:false as const,evento_id:ultimo.id,aprovador:ultimo.user_id!,quando:ultimo.quando,loja_id:e.loja_id,produto_id:e.produto_id,aplicacao_id:e.aplicacao_id};
 }catch{return negar("historico_nao_confirmado");}
}
