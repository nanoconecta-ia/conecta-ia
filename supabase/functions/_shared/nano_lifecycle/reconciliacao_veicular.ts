// Auditoria de identidade veicular legada, somente leitura. O candidato a modelo
// NÃO é aprovação de compatibilidade. Fonte livre legada nunca substitui a prova
// estruturada de regras_aplicacao.ts. Sem DML, rede ou publicação.
export interface ModeloRelacional {id:string;nome:string;montadora_id:string;montadora:string}
export interface AplicacaoLegada {id:string;loja_id:string;produto_id:string;modelo:string;modelo_id:string|null;motorizacao:string|null;ano_inicial:number|null;ano_final:number|null;codigo_oem:string|null;fonte:string|null;coletado_em:string|null;status:string}
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
const contradicao=(s:string)=>/\b(?:nao homologad[oa]s?|a homologar|sem homologacao|nao confirmad[oa]s?)\b/.test(norm(s));
const anoValido=(x:number|null)=>x!==null&&Number.isInteger(x)&&x>=1950&&x<=2100;
export function auditarAplicacoesLegadas(loja:string,aplicacoes:readonly AplicacaoLegada[],modelos:readonly ModeloRelacional[]){
 if(!loja||aplicacoes.some(a=>a.loja_id!==loja))throw Error("escopo invalido");
 if(new Set(aplicacoes.map(a=>a.id)).size!==aplicacoes.length||new Set(modelos.map(m=>m.id)).size!==modelos.length)throw Error("identidade duplicada");
 const resultados=aplicacoes.map(a=>{
  const candidatos=modelos.filter(m=>!!m.id&&!!m.montadora_id&&!!m.montadora.trim()&&!!a.modelo.trim()&&norm(m.nome)===norm(a.modelo));
  const atual=a.modelo_id?modelos.find(m=>m.id===a.modelo_id):undefined;
  const identidade=a.modelo_id?(atual&&candidatos.some(m=>m.id===atual.id)?"vinculada":"conflito_vinculo"):candidatos.length===1?"candidato_unico":candidatos.length>1?"ambiguo":"sem_no";
  const pendencias:string[]=[];
  if(identidade!=="vinculada")pendencias.push(identidade);
  if(a.status!=="aprovado")pendencias.push("status_nao_aprovado");
  if(!a.fonte?.trim()||!a.coletado_em||!Number.isFinite(Date.parse(a.coletado_em)))pendencias.push("fonte_ou_data_ausente");
  if(contradicao(a.fonte??""))pendencias.push("fonte_declara_homologacao_pendente");
  if(!a.motorizacao?.trim())pendencias.push("motor_ausente");
  if(/[\/;]/.test(a.motorizacao??""))pendencias.push("motor_composto_a_revisar");
  if(!anoValido(a.ano_inicial))pendencias.push("ano_inicial_ausente_ou_invalido");
  if(!anoValido(a.ano_final))pendencias.push("ano_final_ausente_ou_invalido");
  if(a.ano_inicial!==null&&a.ano_final!==null&&a.ano_final<a.ano_inicial)pendencias.push("periodo_invertido");
  if(!a.codigo_oem?.trim())pendencias.push("oem_ausente");
  // Campo fonte livre não certifica catálogo, tipo de ano, versão, mercado ou prova direta.
  pendencias.push("evidencia_tecnica_estruturada_a_verificar");
  return {aplicacao_id:a.id,produto_id:a.produto_id,identidade,modelo_id_atual:a.modelo_id,candidato:identidade==="candidato_unico"?{id:candidatos[0].id,montadora_id:candidatos[0].montadora_id,modelo:candidatos[0].nome,montadora:candidatos[0].montadora}:null,pendencias,acao:"revisao" as const};
 });
 return {modo:"auditoria_somente_leitura" as const,total:resultados.length,vinculadas:resultados.filter(r=>r.identidade==="vinculada").length,candidatosUnicos:resultados.filter(r=>r.identidade==="candidato_unico").length,conflitosFonte:resultados.filter(r=>r.pendencias.includes("fonte_declara_homologacao_pendente")).length,resultados};
}
