// Índice de verificações técnicas, não probabilidade de correção nem autorização de deploy.
// Lista esperada vem de política de CI versionada e da revisão selecionada.
export type CheckCI={id:string;revisao:string;estado:"aprovado"|"falhou"|"pendente"|"ignorado"};
export function qualidadeCI(revisao:string,obrigatorios:readonly string[],checks:readonly CheckCI[]){
 if(!revisao.trim()||!obrigatorios.length||new Set(obrigatorios).size!==obrigatorios.length||obrigatorios.some(x=>!x.trim()))throw Error("politica CI invalida");
 const estados=obrigatorios.map(id=>{
  const c=checks.filter(x=>x.revisao===revisao&&x.id===id);
  return {id,estado:c.length===1?c[0].estado:"pendente" as const};
 });
 const aprovados=estados.filter(x=>x.estado==="aprovado").length,falhas=estados.filter(x=>x.estado==="falhou").length;
 return {revisao,aprovados,falhas,pendentes:estados.length-aprovados-falhas,total:estados.length,indice:aprovados/estados.length,ciCompleto:aprovados===estados.length,estados};
}
