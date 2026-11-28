// Nano Lifecycle: detector puro, sem acesso ao ERP, rede, fila ou publicação.
// Recebe snapshots completos do espelho da mesma loja. A integração só deve
// chamar após sincronização bem-sucedida; a fila deverá revalidar pausas e identidade.
export interface ProdutoLifecycle {
  id: string; loja_id: string; bling_id: string | null; sku: string | null;
  situacao: string | null; nome?: string | null; marca?: string | null;
  gtin?: string | null; categoria_bling_id?: string | null;
  descricao_curta?: string | null; descricao_complementar?: string | null;
  peso_kg?: number | null; largura_cm?: number | null;
  altura_cm?: number | null; profundidade_cm?: number | null;
  formato?: string | null; pai_bling_id?: string | null;
  preco?: number | null; estoque?: number | null; publicado?: boolean;
}
const CAMPOS = ["sku","nome","marca","gtin","categoria_bling_id","descricao_curta","descricao_complementar","peso_kg","largura_cm","altura_cm","profundidade_cm","formato","pai_bling_id"] as const;
const norm = (v: unknown) => typeof v === "string" ? v.trim() || null : v ?? null;
const key = (p: ProdutoLifecycle) => JSON.stringify([p.loja_id, p.bling_id]);
export type Evento = { produto_id: string; loja_id: string; bling_id: string; sku: string; tipo: "novo"|"reativado"|"alteracao_tecnica"|"inativado"; campos: string[] };
export type Bloqueio = { produto_id: string; motivo: "identidade_incompleta"|"sku_duplicado"|"bling_id_duplicado"|"pausado"|"identidade_alterada" };
export function detectarLifecycle(loja: string, antes: ProdutoLifecycle[], depois: ProdutoLifecycle[], pausados: ReadonlySet<string>, sincronizacaoCompleta: boolean): { eventos: Evento[]; bloqueios: Bloqueio[]; incompleto: boolean } {
  if (!sincronizacaoCompleta) return { eventos: [], bloqueios: [], incompleto: true };
  if (!loja || [...antes,...depois].some(p=>p.loja_id!==loja)) throw new Error("snapshot fora da loja");
  const anterior = new Map(antes.filter(p=>p.bling_id).map(p=>[key(p),p]));
  const porSku = new Map<string,Set<string>>(), porId = new Map<string,number>();
  for (const p of depois) {
    if (p.bling_id) porId.set(p.bling_id,(porId.get(p.bling_id)??0)+1);
    const sku=String(norm(p.sku)??"").toUpperCase();
    if(sku && p.bling_id) { const ids=porSku.get(sku)??new Set<string>(); ids.add(p.bling_id); porSku.set(sku,ids); }
  }
  const eventos: Evento[]=[], bloqueios: Bloqueio[]=[];
  for (const p of depois) {
    const prev=anterior.get(key(p)), ativo=p.situacao==="A";
    if(!ativo && prev?.situacao!=="A") continue;
    const sku=String(norm(p.sku)??"");
    const bloquear=(motivo: Bloqueio["motivo"])=>bloqueios.push({produto_id:p.id,motivo});
    if(!sku || !p.id || !p.bling_id || !/^[1-9][0-9]*$/.test(p.bling_id)){bloquear("identidade_incompleta");continue;}
    if((porId.get(p.bling_id)??0)>1){bloquear("bling_id_duplicado");continue;}
    if((porSku.get(sku.toUpperCase())?.size??0)>1){bloquear("sku_duplicado");continue;}
    if(prev && prev.id!==p.id){bloquear("identidade_alterada");continue;}
    if(pausados.has(p.id) && ativo){bloquear("pausado");continue;}
    const campos=prev?CAMPOS.filter(c=>norm(prev[c])!==norm(p[c])):[...CAMPOS];
    const tipo=!ativo?"inativado":!prev?"novo":prev.situacao!=="A"?"reativado":campos.length?"alteracao_tecnica":null;
    if(tipo) eventos.push({produto_id:p.id,loja_id:loja,bling_id:p.bling_id,sku,tipo,campos});
  }
  return {eventos,bloqueios,incompleto:false};
}
