// Comparação estrutural de árvores Git completas, não inventário operacional.
// Entradas devem vir de snapshots confiáveis, imutáveis, completos e conferidos
// pela autoridade de release. Não confiar em listas parciais do agente.
export type EntradaPatrimonial={path:string;mode:string;type:"blob"|"commit";sha:string};
export type SnapshotPatrimonial={commit:string;tree:string;completo:boolean;entradas:readonly EntradaPatrimonial[]};
const hash=(s:string)=>typeof s==="string"&&/^[a-f0-9]{40}$/.test(s);
function indexar(s:SnapshotPatrimonial){
 if(s.completo!==true||!hash(s.commit)||!hash(s.tree)||!s.entradas.length)throw Error("snapshot patrimonial incompleto");
 const m=new Map<string,EntradaPatrimonial>();
 for(const e of s.entradas){
  if(typeof e.path!=="string"||!e.path||e.path.startsWith("/")||/[\\\x00-\x1f\x7f]/.test(e.path)||e.path.split("/").some(p=>!p||p==="."||p==="..")||!hash(e.sha)||!((e.type==="blob"&&["100644","100755","120000"].includes(e.mode))||(e.type==="commit"&&e.mode==="160000"))||m.has(e.path))throw Error("entrada patrimonial inválida ou duplicada");
  m.set(e.path,e);
 }
 return m;
}
export function compararPatrimonioCodigo(baseline:SnapshotPatrimonial,candidato:SnapshotPatrimonial){
 const b=indexar(baseline),c=indexar(candidato);
 const itens=[...b.values()].map(e=>{
  const novo=c.get(e.path);
  const estado=!novo?"ausente" as const:novo.sha===e.sha&&novo.mode===e.mode&&novo.type===e.type?"identico" as const:"alterado" as const;
  return {path:e.path,estado,sha_base:e.sha,sha_candidato:novo?.sha??null,mode_base:e.mode,mode_candidato:novo?.mode??null};
 });
 const novos=[...c.keys()].filter(p=>!b.has(p)).sort();
 const identicos=itens.filter(i=>i.estado==="identico").length;
 const alterados=itens.filter(i=>i.estado==="alterado").length;
 const ausentes=itens.filter(i=>i.estado==="ausente").length;
 // Arquivos novos não compensam perdas; mudança de hash/modo não comprova
 // regressão, mas exige análise. Nem mesmo hashes iguais provam operação.
 return {base:baseline.commit,candidato:candidato.commit,obrigatorios:b.size,identicos,alterados,ausentes,novos:novos.length,indicePresenca:(b.size-ausentes)/b.size,indiceIdentidade:identicos/b.size,pendencias:itens.filter(i=>i.estado!=="identico"),itens,pathsNovos:novos,homologacaoOperacional:false as const};
}
