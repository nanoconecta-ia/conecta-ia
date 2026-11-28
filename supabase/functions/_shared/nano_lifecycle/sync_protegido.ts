// Porta de sincronização experimental: reaproveita o algoritmo do Bling.
// Nunca recebe portas de escrita legadas. Não conectar ao cron antes da homologação.
import {sincronizar,type PortasSync,type GrupoLista,type ResultadoSync,type LinhaProduto} from "../bling_sync.ts";
import type {Reserva} from "./rodada_sync.ts";
import type {RpcServidor} from "./porta_supabase.ts";
export type LeituraBling=Pick<PortasSync,"listarPagina"|"detalhe"|"existentes"|"registrarErro"|"espera"|"agora">;
type Grupos=Record<GrupoLista,string[][]>;
const ordem:GrupoLista[]=["ativos","inativos","excluidos"];
const situacoes={ativos:"A",inativos:"I",excluidos:"E"} as const;
const CAMPOS=["loja_id","bling_id","sku","nome","preco","estoque","situacao","categoria_bling_id","marca","gtin","gtin_tributario","descricao_curta","descricao_complementar","peso_kg","largura_cm","altura_cm","profundidade_cm","unidade","condicao","formato","pai_bling_id","volumes","sincronizado_em"] as const;
const limpar=(l:LinhaProduto)=>Object.fromEntries(CAMPOS.map(k=>[k,l[k]??null]));
export async function sincronizarComReserva(admin:RpcServidor,origem:LeituraBling,reserva:Reserva,orcamentoMs=100_000):Promise<ResultadoSync>{
 const grupos:Grupos={ativos:[],inativos:[],excluidos:[]};
 const vistos=new Map<number,GrupoLista>();
 let grupoAtual=0;
 let ausentesLocais:string[]=[];
 let existentesLidos=false;
 const fence={p_loja:reserva.loja,p_execucao:reserva.execucao,p_geracao:reserva.geracao};
 const rpc=async(nome:string,args:Record<string,unknown>)=>{const r=await admin.rpc(nome,{...fence,...args});if(r.error)throw Error("falha RPC sync protegido: "+nome);return r.data};
 const p:PortasSync={
  async existentes(){
   if(existentesLidos)throw Error("leitura repetida");
   existentesLidos=true;
   const a=await origem.existentes();
   if(!Array.isArray(a)||a.length>5000||new Set(a.map(e=>e.bling_id)).size!==a.length)throw Error("espelho incompleto ou duplicado");
   if(a.some(e=>!e.bling_id||e.loja_id!==undefined&&e.loja_id!==reserva.loja))throw Error("espelho fora do escopo");
   return a;
  },
  async listarPagina(pagina,limite,grupo="ativos"){
   if(grupo!==ordem[grupoAtual]||limite!==100||pagina!==grupos[grupo].length+1||pagina>51)return {erro:"sequência de páginas inválida"};
   const r=await origem.listarPagina(pagina,limite,grupo);
   if("erro" in r)return r;
   if(!Array.isArray(r.itens)||r.itens.length>100)return {erro:"página inválida"};
   const ids:number[]=[], locais=new Set<number>();
   for(const item of r.itens){
    if(!item||!Number.isSafeInteger(item.id)||item.id<=0||vistos.has(item.id)||locais.has(item.id))return {erro:"identidade inválida ou repetida"};
    if(grupo!=="excluidos"&&item.situacao!==situacoes[grupo])return {erro:"situação divergente do grupo"};
    if(grupo==="excluidos"&&item.situacao!=null&&item.situacao!=="E")return {erro:"situação divergente do grupo"};
    locais.add(item.id);ids.push(item.id);
   }
   if(vistos.size+ids.length>5000)return {erro:"varredura excede limite"};
   for(const id of ids)vistos.set(id,grupo);
   grupos[grupo].push(ids.map(String));
   if(ids.length<100)grupoAtual++;
   return r;
  },
  async detalhe(id){
   const g=vistos.get(id);if(!g)throw Error("detalhe sem listagem");
   const d=await origem.detalhe(id);
   if(d===null)return null;
   if(typeof d!=="object"||d.id!==id||d.situacao!==situacoes[g])throw Error("detalhe divergente da listagem");
   return d;
  },
  async gravar(linhas){
   if(linhas.some(l=>l.loja_id!==reserva.loja||!vistos.has(Number(l.bling_id))))throw Error("lote fora da varredura");
   const n=await rpc("nano_lifecycle_gravar_espelho",{p_linhas:linhas.map(limpar)});
   if(n!==linhas.length)throw Error("gravação parcial");
  },
  // Não chamar update legado de ausência. A lista será reconciliada com SQL.
  async marcarAusentes(ids){ausentesLocais=[...ids]},
  registrarErro:(m,d)=>origem.registrarErro(m,d),
  espera:ms=>origem.espera(ms),
  agora:()=>origem.agora()
 };
 // Forçar SKUs antes de listá-los é incompatível com este protocolo de evidência.
 // Imagens também ficam fora desta porta até terem uma operação protegida própria.
 const resultado=await sincronizar(reserva.loja,p,orcamentoMs);
 if(!resultado.completo||resultado.erro)return resultado;
 if(grupoAtual!==3||resultado.vistos!==vistos.size||resultado.paginas!==ordem.reduce((n,g)=>n+grupos[g].length,0))return {...resultado,completo:false,erro:"evidência incompleta"};
 const d=await rpc("nano_lifecycle_registrar_varredura",{p_grupos:grupos});
 if(!d||typeof d!=="object"||Array.isArray(d))throw Error("varredura não confirmada");
 const x=d as {estado?:unknown;candidatos?:unknown};
 if(x.estado!=="registrada"&&x.estado!=="ja_registrada"||!Array.isArray(x.candidatos))throw Error("varredura não confirmada");
 const candidatos=x.candidatos.map(c=>{if(!c||typeof c.bling_id!=="string"||typeof c.produto_id!=="string"||vistos.has(Number(c.bling_id)))throw Error("candidato inválido");return c.bling_id});
 if(new Set(candidatos).size!==candidatos.length||JSON.stringify([...candidatos].sort())!==JSON.stringify([...ausentesLocais].sort()))throw Error("ausências divergentes do espelho");
 // Sem política de confirmação homologada, qualquer ausência retém checkpoint.
 // "ausentes" significa candidatos, não produtos alterados; retornamos zero alterações.
 if(candidatos.length)return {...resultado,ausentes:0,completo:false,erro:"ausencias_pendentes_de_revisao"};
 return {...resultado,ausentes:0};
}
